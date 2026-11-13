import * as assert from 'remix/assert'
import { type Database, sql } from 'remix/data-table'
import { after, before, beforeEach, describe, it } from 'remix/test'

import { createTestApp, type TestApp, type TestClient } from '../../../../test/app.ts'
import { signIn } from '../../../../test/auth.ts'
import { createActiveCollectif } from '../../../../test/collectifs.ts'
import { openTestDatabase, resetDatabase } from '../../../../test/database.ts'
import { createActiveUser } from '../../../../test/users.ts'
import { decideMembership, findMembership, requestMembership } from '../../../data/members.ts'
import type { Collectif, Membership, User } from '../../../data/tables.ts'
import { setUserRole } from '../../../data/users.ts'
import { routes } from '../../../routes.ts'

/** Role and status of a membership row, or null. */
const roleOf = (row: Membership | null) => (row ? [row.role, row.status] : null)

describe('responsibles named by responsibles, and leaving (US-0.8.6, US-0.8.8)', () => {
  let db: Database
  let app: TestApp
  let frog: Collectif
  let rita: User
  let sami: User
  let rita_: TestClient
  let sami_: TestClient

  before(async () => {
    db = await openTestDatabase()
  })
  beforeEach(async () => {
    await resetDatabase(db)
    rita = await createActiveUser(db, 'Rita', 'rita@example.org')
    sami = await createActiveUser(db, 'Sami', 'sami@example.org')
    frog = await createActiveCollectif(db, "Collecti'FROG", rita.id)
    await requestMembership(db, sami.id, frog.id)
    await decideMembership(db, {
      userId: sami.id,
      collectifId: frog.id,
      from: { status: 'pending' },
      status: 'active',
      decidedBy: rita.id,
    })
    app = createTestApp(db)
    rita_ = app.client()
    await signIn(app, rita_, 'rita@example.org')
    sami_ = app.client()
    await signIn(app, sami_, 'sami@example.org')
  })
  after(async () => {
    await db.close()
  })

  const url = (action: 'promote' | 'demote', user: User) =>
    routes.collectifs.members[action].href({ slug: frog.slug, userId: user.id })
  const members = (client: TestClient) =>
    client.get(routes.collectifs.people.href({ slug: frog.slug }))

  it('lets a responsible name a member responsible, e-mailed and logged', async () => {
    assert.match((await members(rita_)).text, /Nommer Sami responsable/)
    await rita_.post(url('promote', sami))
    assert.deepEqual(roleOf(await findMembership(db, sami.id, frog.id)), ['responsible', 'active'])
    const mail = app.mailer.outbox.findLast((m) => m.to === 'sami@example.org')
    assert.match(mail?.subject ?? '', /Vous êtes responsable de « Collecti'FROG »/)
    const log = await db.exec(sql`select action from audit_log order by at desc limit 1`)
    assert.equal(log.rows?.[0]?.action, 'responsible.named')
    // Sami manages it from the next request on.
    assert.match((await members(sami_)).text, /Retirer le rôle de responsable à Rita/)
  })

  it('keeps a removed responsible as a member', async () => {
    await rita_.post(url('promote', sami))
    await sami_.post(url('demote', rita))
    assert.deepEqual(roleOf(await findMembership(db, rita.id, frog.id)), ['member', 'active'])
    const mail = app.mailer.outbox.findLast((m) => m.to === 'rita@example.org')
    assert.match(mail?.text ?? '', /Vous en restez membre/)
  })

  it('never removes the last responsible', async () => {
    const html = (await members(rita_)).text
    assert.doesNotMatch(html, /Retirer le rôle de responsable à Rita/)
    await rita_.post(url('demote', rita))
    assert.deepEqual(roleOf(await findMembership(db, rita.id, frog.id)), ['responsible', 'active'])
    assert.match((await members(rita_)).text, /C’est le dernier responsable/)
  })

  it('refuses a member, and lets an admin or a moderator do it', async () => {
    assert.equal((await sami_.post(url('promote', sami))).status, 403)
    assert.doesNotMatch((await members(sami_)).text, /Nommer/)
    const mona = await createActiveUser(db, 'Mona', 'mona@example.org')
    await setUserRole(db, mona.id, 'moderator')
    const mona_ = app.client()
    await signIn(app, mona_, 'mona@example.org')
    await mona_.post(url('promote', sami))
    assert.deepEqual(roleOf(await findMembership(db, sami.id, frog.id)), ['responsible', 'active'])
  })

  it('lets a member leave: they no longer see the collectif', async () => {
    assert.match((await members(sami_)).text, /Quitter « Collecti'FROG »/)
    const response = await sami_.post(routes.collectifs.members.leave.href({ slug: frog.slug }))
    assert.equal(response.location, routes.collectifs.index.href())
    assert.deepEqual(roleOf(await findMembership(db, sami.id, frog.id)), ['member', 'removed'])
    const page = (await sami_.get(routes.collectifs.show.href({ slug: frog.slug }))).text
    assert.match(page, /Demander à rejoindre/)
    const log = await db.exec(sql`select action from audit_log order by at desc limit 1`)
    assert.equal(log.rows?.[0]?.action, 'member.left')
  })

  it('keeps the last responsible until they name another', async () => {
    assert.match((await members(rita_)).text, /Vous êtes le seul responsable/)
    await rita_.post(routes.collectifs.members.leave.href({ slug: frog.slug }))
    assert.deepEqual(roleOf(await findMembership(db, rita.id, frog.id)), ['responsible', 'active'])
    await rita_.post(url('promote', sami))
    await rita_.post(routes.collectifs.members.leave.href({ slug: frog.slug }))
    assert.deepEqual(roleOf(await findMembership(db, rita.id, frog.id)), ['responsible', 'removed'])
  })

  it('refuses to leave a collectif one does not belong to', async () => {
    await createActiveUser(db, 'Lou', 'lou@example.org')
    const lou = app.client()
    await signIn(app, lou, 'lou@example.org')
    const response = await lou.post(routes.collectifs.members.leave.href({ slug: frog.slug }))
    assert.equal(response.status, 403)
  })
})
