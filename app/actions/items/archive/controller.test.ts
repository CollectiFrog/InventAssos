import * as assert from 'remix/assert'
import type { Database } from 'remix/data-table'
import { after, before, beforeEach, describe, it } from 'remix/test'

import { createTestApp, type TestApp } from '../../../../test/app.ts'
import { signIn } from '../../../../test/auth.ts'
import { openTestDatabase, resetDatabase } from '../../../../test/database.ts'
import { createTestItem } from '../../../../test/items.ts'
import { createTestLocation } from '../../../../test/locations.ts'
import { createActiveUser } from '../../../../test/users.ts'
import { listEntityHistory } from '../../../data/audit-log.ts'
import { findItemById } from '../../../data/items.ts'
import type { Item } from '../../../data/tables.ts'
import { routes } from '../../../routes.ts'

describe('archive an item (US-0.5.5)', () => {
  let db: Database
  let app: TestApp
  let item: Item

  before(async () => {
    db = await openTestDatabase()
  })
  beforeEach(async () => {
    await resetDatabase(db)
    const max = await createActiveUser(db, 'Max', 'max@example.org')
    await createActiveUser(db, 'Lou', 'lou@example.org')
    const garage = await createTestLocation(db, { userId: max.id }, 'Garage')
    item = await createTestItem(db, {
      locationId: garage.id,
      owner: { userId: max.id },
      createdBy: max.id,
      name: 'Vieux projecteur',
    })
    app = createTestApp(db)
  })
  after(async () => {
    await db.close()
  })

  async function clientFor(email: string) {
    const client = app.client()
    await signIn(app, client, email)
    return client
  }

  it('takes the item out of the lists but keeps its page and its row', async () => {
    const max = await clientFor('max@example.org')
    const response = await max.post(routes.items.archive.action.href({ itemId: item.id }), {
      reason: 'broken',
    })

    assert.equal(response.location, routes.items.show.href({ itemId: item.id }))
    const archived = await findItemById(db, item.id)
    assert.ok(archived?.archived_at)
    assert.equal(archived?.archive_reason, 'broken')
    const page = await max.get(routes.items.show.href({ itemId: item.id }))
    assert.match(page.text, /Archivé le/)
    assert.doesNotMatch(page.text, /\/archiver"/)
    assert.doesNotMatch((await max.get(routes.items.index.href())).text, /Vieux projecteur/)
    assert.equal((await listEntityHistory(db, 'item', item.id)).at(-1)?.action, 'item.archived')
  })

  it('hides an archived item from people who do not manage it', async () => {
    const max = await clientFor('max@example.org')
    await max.post(routes.items.archive.action.href({ itemId: item.id }), { reason: 'sold' })

    const lou = await clientFor('lou@example.org')
    assert.equal((await lou.get(routes.items.show.href({ itemId: item.id }))).status, 404)
  })

  it('refuses someone who may not edit the item (403)', async () => {
    const lou = await clientFor('lou@example.org')
    const response = await lou.post(routes.items.archive.action.href({ itemId: item.id }), {
      reason: 'lost',
    })
    assert.equal(response.status, 403)
    assert.equal((await findItemById(db, item.id))?.archived_at, null)
  })

  it('requires a known reason', async () => {
    const max = await clientFor('max@example.org')
    const response = await max.post(routes.items.archive.action.href({ itemId: item.id }), {
      reason: 'stolen-by-aliens',
    })
    assert.equal(response.status, 400)
  })
})
