// Regressions for the security review of V0.8 (2026-11-12): each case reproduces a finding.
import * as assert from 'remix/assert'
import { type Database, sql } from 'remix/data-table'
import { after, before, beforeEach, describe, it } from 'remix/test'

import { createTestApp, type TestApp, type TestClient } from '../test/app.ts'
import { signIn } from '../test/auth.ts'
import { createActiveCollectif, createPendingCollectif } from '../test/collectifs.ts'
import { openTestDatabase, resetDatabase } from '../test/database.ts'
import { createTestItem } from '../test/items.ts'
import { createTestLocation } from '../test/locations.ts'
import { createActiveUser } from '../test/users.ts'
import { findCollectifById } from './data/collectifs.ts'
import { findItemById } from './data/items.ts'
import {
  decideMembership,
  findMembership,
  requestMembership,
  setMembershipRole,
  setResponsible,
} from './data/members.ts'
import type { Collectif, Membership, User } from './data/tables.ts'
import { setUserRole, setUserStatus } from './data/users.ts'
import { routes } from './routes.ts'

const roleOf = (row: Membership | null) => (row ? [row.role, row.status] : null)

describe('security review of V0.8', () => {
  let db: Database
  let app: TestApp
  let frog: Collectif
  let rita: User
  let mona: User
  let monaClient: TestClient
  let ritaClient: TestClient

  before(async () => {
    db = await openTestDatabase()
  })
  beforeEach(async () => {
    await resetDatabase(db)
    rita = await createActiveUser(db, 'Rita', 'rita@example.org')
    mona = await createActiveUser(db, 'Mona', 'mona@example.org')
    await setUserRole(db, mona.id, 'moderator')
    frog = await createActiveCollectif(db, "Collecti'FROG", rita.id)
    app = createTestApp(db, { adminEmails: ['boss@example.org'] })
    monaClient = app.client()
    await signIn(app, monaClient, 'mona@example.org')
    ritaClient = app.client()
    await signIn(app, ritaClient, 'rita@example.org')
  })
  after(async () => {
    await db.close()
  })

  const ids = (user: User) => ({ collectifId: frog.id, userId: user.id })

  it('F1: a moderator cannot approve their own request to become responsible', async () => {
    await monaClient.post(routes.collectifs.requestResponsibility.href({ slug: frog.slug }))
    const response = await monaClient.post(routes.admin.responsibles.approve.href(ids(mona)))
    assert.equal(response.status, 403)
    assert.deepEqual(roleOf(await findMembership(db, mona.id, frog.id)), ['responsible', 'pending'])
  })

  it('F1: a moderator cannot name themselves as the replacement of a responsible', async () => {
    const response = await monaClient.post(routes.admin.responsibles.remove.href(ids(rita)), {
      replacementEmail: 'mona@example.org',
    })
    assert.equal(response.status, 403)
    assert.deepEqual(roleOf(await findMembership(db, rita.id, frog.id)), ['responsible', 'active'])
    assert.equal(await findMembership(db, mona.id, frog.id), null)
  })

  it('F1: a moderator who is a member cannot promote themselves; a responsible may', async () => {
    await requestMembership(db, mona.id, frog.id)
    await decideMembership(db, {
      userId: mona.id,
      collectifId: frog.id,
      from: { status: 'pending' },
      status: 'active',
      decidedBy: rita.id,
    })
    const promote = routes.collectifs.members.promote.href({ slug: frog.slug, userId: mona.id })
    assert.equal((await monaClient.post(promote)).status, 403)
    assert.deepEqual(roleOf(await findMembership(db, mona.id, frog.id)), ['member', 'active'])
    // A responsible of the collectif may still name her.
    await ritaClient.post(promote)
    assert.deepEqual(roleOf(await findMembership(db, mona.id, frog.id)), ['responsible', 'active'])
  })

  it('F1: a moderator cannot approve the collectif they asked for', async () => {
    const pending = await createPendingCollectif(db, 'Collectif de Mona', mona.id)
    const url = routes.admin.collectifs.approve.href({ collectifId: pending.id })
    assert.equal((await monaClient.post(url)).status, 403)
    assert.equal((await findCollectifById(db, pending.id))?.status, 'pending')
  })

  it('F2: a moderator cannot take the responsible role from an admin or a moderator', async () => {
    const boss = await createActiveUser(db, 'Boss', 'boss@example.org')
    const max = await createActiveUser(db, 'Max', 'max@example.org')
    await setUserRole(db, max.id, 'moderator')
    for (const target of [boss, max]) {
      await setResponsible(db, { userId: target.id, collectifId: frog.id, status: 'active' })
      const demote = routes.collectifs.members.demote.href({ slug: frog.slug, userId: target.id })
      assert.equal((await monaClient.post(demote)).status, 403)
      const remove = routes.admin.responsibles.remove.href(ids(target))
      assert.equal((await monaClient.post(remove)).status, 403)
      assert.deepEqual(roleOf(await findMembership(db, target.id, frog.id)), [
        'responsible',
        'active',
      ])
    }
    // Rita, responsible of the collectif, still decides within it.
    await ritaClient.post(
      routes.collectifs.members.demote.href({ slug: frog.slug, userId: max.id }),
    )
    assert.deepEqual(roleOf(await findMembership(db, max.id, frog.id)), ['member', 'active'])
  })

  it('F2: a moderator cannot archive or delete the item of an admin or a moderator', async () => {
    const max = await createActiveUser(db, 'Max', 'max@example.org')
    await setUserRole(db, max.id, 'moderator')
    const home = await createTestLocation(db, { userId: max.id }, 'Chez Max')
    const item = await createTestItem(db, {
      locationId: home.id,
      owner: { userId: max.id },
      createdBy: max.id,
      name: 'Ampli de Max',
    })
    const page = (await monaClient.get(routes.items.show.href({ itemId: item.id }))).text
    assert.doesNotMatch(page, /Supprimer…|Retirer \(modération\)/)
    const archive = await monaClient.post(routes.items.archive.action.href({ itemId: item.id }), {
      reason: 'moderated',
      message: 'Abus.',
    })
    assert.equal(archive.status, 403)
    const remove = await monaClient.post(routes.items.remove.action.href({ itemId: item.id }), {
      message: 'Abus.',
    })
    assert.equal(remove.status, 403)
    assert.notEqual(await findItemById(db, item.id), null)
  })

  it('F2: the platform gives a reason to delete, e-mailed to each owner apart', async () => {
    const cora = await createActiveUser(db, 'Cora', 'cora@example.org')
    await setResponsible(db, { userId: cora.id, collectifId: frog.id, status: 'active' })
    const local = await createTestLocation(db, { collectifId: frog.id }, 'Local')
    const item = await createTestItem(db, {
      locationId: local.id,
      owner: { collectifId: frog.id },
      createdBy: rita.id,
      name: 'Annonce douteuse',
    })
    const url = routes.items.remove.action.href({ itemId: item.id })
    const form = (await monaClient.get(routes.items.remove.index.href({ itemId: item.id }))).text
    assert.match(form, /Message au propriétaire/)
    const empty = await monaClient.post(url, { message: ' ' })
    assert.equal(empty.status, 400)
    assert.notEqual(await findItemById(db, item.id), null)

    await monaClient.post(url, { message: 'Annonce commerciale.' })
    assert.equal(await findItemById(db, item.id), null)
    const mails = app.mailer.outbox.filter((m) => /supprimé par la modération/.test(m.subject))
    assert.deepEqual(mails.map((m) => m.to).sort(), ['cora@example.org', 'rita@example.org'])
    assert.match(mails[0]?.text ?? '', /Annonce commerciale\./)
    const log = await db.exec(sql`select payload from audit_log where action = 'item.deleted'`)
    assert.doesNotMatch(JSON.stringify(log.rows), /Annonce/)
  })

  it('F2: an owner deletes without a reason, and nobody is e-mailed', async () => {
    const local = await createTestLocation(db, { collectifId: frog.id }, 'Local')
    const item = await createTestItem(db, {
      locationId: local.id,
      owner: { collectifId: frog.id },
      createdBy: rita.id,
      name: 'Doublon',
    })
    const form = (await ritaClient.get(routes.items.remove.index.href({ itemId: item.id }))).text
    assert.doesNotMatch(form, /Message au propriétaire/)
    await ritaClient.post(routes.items.remove.action.href({ itemId: item.id }))
    assert.equal(await findItemById(db, item.id), null)
    assert.equal(
      app.mailer.outbox.some((m) => /supprimé/.test(m.subject)),
      false,
    )
  })

  it('F3: a disabled co-responsible does not count: the last active one cannot leave', async () => {
    const sami = await createActiveUser(db, 'Sami', 'sami@example.org')
    await setResponsible(db, { userId: sami.id, collectifId: frog.id, status: 'active' })
    await setUserStatus(db, sami.id, 'disabled')
    await ritaClient.post(routes.collectifs.members.leave.href({ slug: frog.slug }))
    assert.deepEqual(roleOf(await findMembership(db, rita.id, frog.id)), ['responsible', 'active'])
    const demote = routes.collectifs.members.demote.href({ slug: frog.slug, userId: rita.id })
    await ritaClient.post(demote)
    assert.deepEqual(roleOf(await findMembership(db, rita.id, frog.id)), ['responsible', 'active'])
  })

  it('F3: disabling the only responsible of a collectif says so', async () => {
    await monaClient.post(routes.admin.disableAccount.href({ userId: rita.id }))
    const page = (await monaClient.get(routes.admin.accounts.href())).text
    assert.match(page, /Sans autre responsable actif : Collecti'FROG/)
  })

  it('F5: a decision applies only to the state it expects', async () => {
    const nina = await createActiveUser(db, 'Nina', 'nina@example.org')
    await requestMembership(db, nina.id, frog.id)
    const accept = { userId: nina.id, collectifId: frog.id, decidedBy: rita.id }
    const pending = { role: 'member', status: 'pending' } as const
    assert.equal(await decideMembership(db, { ...accept, from: pending, status: 'active' }), true)
    // The same decision replayed, or a rejection arriving late, changes nothing.
    assert.equal(
      await decideMembership(db, { ...accept, from: pending, status: 'rejected' }),
      false,
    )
    assert.deepEqual(roleOf(await findMembership(db, nina.id, frog.id)), ['member', 'active'])
    // A role change needs the other role: promoting twice is refused the second time.
    assert.equal(await setMembershipRole(db, { ...accept, role: 'responsible' }), true)
    assert.equal(await setMembershipRole(db, { ...accept, role: 'responsible' }), false)
    // A member decision never touches a responsible row.
    const asMember = { role: 'member', status: 'active' } as const
    assert.equal(
      await decideMembership(db, { ...accept, from: asMember, status: 'removed' }),
      false,
    )
  })

  it('F6: a name cannot hold a line break', async () => {
    const response = await ritaClient.post(routes.account.profile.action.href(), {
      name: 'Rita\nCliquez ici : https://example.org',
      phone: '',
    })
    assert.equal(response.status, 400)
    assert.match(response.text, /Une seule ligne/)
  })
})
