import * as assert from 'remix/assert'
import { type Database, sql } from 'remix/data-table'
import { after, before, beforeEach, describe, it } from 'remix/test'

import { createTestApp, type TestApp, type TestClient } from '../../../../test/app.ts'
import { signIn } from '../../../../test/auth.ts'
import { createActiveCollectif } from '../../../../test/collectifs.ts'
import { openTestDatabase, resetDatabase } from '../../../../test/database.ts'
import { createTestItem } from '../../../../test/items.ts'
import { createTestLocation } from '../../../../test/locations.ts'
import { createActiveUser } from '../../../../test/users.ts'
import { hasDeletionRequest } from '../../../data/deletion-requests.ts'
import { archiveItem, findItemById } from '../../../data/items.ts'
import { decideMembership, requestMembership } from '../../../data/members.ts'
import type { Collectif, Item } from '../../../data/tables.ts'
import { routes } from '../../../routes.ts'

describe('delete an item (US-0.8.9, US-0.8.10)', () => {
  let db: Database
  let app: TestApp
  let frog: Collectif
  let item: Item
  let mine: Item
  let rita: TestClient
  let sami: TestClient

  before(async () => {
    db = await openTestDatabase()
  })
  beforeEach(async () => {
    await resetDatabase(db)
    const ritaUser = await createActiveUser(db, 'Rita', 'rita@example.org')
    const samiUser = await createActiveUser(db, 'Sami', 'sami@example.org')
    frog = await createActiveCollectif(db, "Collecti'FROG", ritaUser.id)
    await requestMembership(db, samiUser.id, frog.id)
    await decideMembership(db, {
      userId: samiUser.id,
      collectifId: frog.id,
      from: { status: 'pending' },
      status: 'active',
      decidedBy: ritaUser.id,
    })
    const local = await createTestLocation(db, { collectifId: frog.id }, 'Local')
    item = await createTestItem(db, {
      locationId: local.id,
      owner: { collectifId: frog.id },
      createdBy: samiUser.id,
      name: 'Doublon',
    })
    const home = await createTestLocation(db, { userId: samiUser.id }, 'Chez Sami')
    mine = await createTestItem(db, {
      locationId: home.id,
      owner: { userId: samiUser.id },
      createdBy: samiUser.id,
      name: 'Perceuse',
    })
    app = createTestApp(db)
    rita = app.client()
    await signIn(app, rita, 'rita@example.org')
    sami = app.client()
    await signIn(app, sami, 'sami@example.org')
  })
  after(async () => {
    await db.close()
  })

  const show = (target: Item) => routes.items.show.href({ itemId: target.id })

  it('asks for confirmation on a page, then deletes for good and logs IDs only', async () => {
    assert.match((await rita.get(show(item))).text, /Supprimer…/)
    const page = (await rita.get(routes.items.remove.index.href({ itemId: item.id }))).text
    assert.match(page, /La suppression est définitive/)
    const response = await rita.post(routes.items.remove.action.href({ itemId: item.id }))
    assert.equal(response.location, routes.collectifs.show.href({ slug: frog.slug }))
    assert.equal(await findItemById(db, item.id), null)
    assert.equal((await rita.get(show(item))).status, 404)
    const log = await db.exec(sql`select action, payload from audit_log
      where entity_id = ${item.id} order by at desc limit 1`)
    assert.equal(log.rows?.[0]?.action, 'item.deleted')
    assert.doesNotMatch(JSON.stringify(log.rows), /Doublon/)
  })

  it('lets a personal owner delete their item, archived or not', async () => {
    await archiveItem(db, mine.id, 'broken')
    await sami.post(routes.items.remove.action.href({ itemId: mine.id }))
    assert.equal(await findItemById(db, mine.id), null)
  })

  it("refuses a member, who asks the collectif's responsibles instead", async () => {
    const page = (await sami.get(show(item))).text
    assert.doesNotMatch(page, /Supprimer…/)
    assert.match(page, /Demander la suppression/)
    assert.equal(
      (await sami.post(routes.items.remove.action.href({ itemId: item.id }))).status,
      403,
    )

    await sami.post(routes.items.requestDeletion.href({ itemId: item.id }))
    assert.equal(await hasDeletionRequest(db, item.id), true)
    assert.match((await sami.get(show(item))).text, /Suppression demandée aux responsables/)
    // No e-mail: the request waits in the Membres tab.
    assert.equal(
      app.mailer.outbox.some((m) => /suppression/i.test(m.subject)),
      false,
    )
    const members = (await rita.get(routes.collectifs.show.href({ slug: frog.slug }))).text
    assert.match(members, /Membres · 1 en attente/)
  })

  it('keeps one open request per item', async () => {
    await sami.post(routes.items.requestDeletion.href({ itemId: item.id }))
    await sami.post(routes.items.requestDeletion.href({ itemId: item.id }))
    assert.match((await sami.get(show(item))).text, /déjà demandée/)
    const n = await db.exec(sql`select count(*)::int as n from item_deletion_requests`)
    assert.equal(n.rows?.[0]?.n, 1)
  })

  it('lets a responsible accept the request: the item is deleted', async () => {
    await sami.post(routes.items.requestDeletion.href({ itemId: item.id }))
    const tab = (await rita.get(routes.collectifs.people.href({ slug: frog.slug }))).text
    assert.match(tab, /Demandes de suppression · 1/)
    assert.match(tab, /demandé par Sami/)
    await rita.post(routes.collectifs.deletions.approve.href({ slug: frog.slug, itemId: item.id }))
    assert.equal(await findItemById(db, item.id), null)
    const n = await db.exec(sql`select count(*)::int as n from item_deletion_requests`)
    assert.equal(n.rows?.[0]?.n, 0)
  })

  it('lets a responsible reject it: the item stays and may be asked again', async () => {
    await sami.post(routes.items.requestDeletion.href({ itemId: item.id }))
    await rita.post(routes.collectifs.deletions.reject.href({ slug: frog.slug, itemId: item.id }))
    assert.notEqual(await findItemById(db, item.id), null)
    assert.equal(await hasDeletionRequest(db, item.id), false)
    assert.match((await sami.get(show(item))).text, /Demander la suppression/)
  })

  it('refuses decisions from a member', async () => {
    await sami.post(routes.items.requestDeletion.href({ itemId: item.id }))
    const url = routes.collectifs.deletions.approve.href({ slug: frog.slug, itemId: item.id })
    assert.equal((await sami.post(url)).status, 403)
    assert.notEqual(await findItemById(db, item.id), null)
  })
})
