import * as assert from 'remix/assert'
import type { Database } from 'remix/data-table'
import { after, before, beforeEach, describe, it } from 'remix/test'

import { createTestApp, type TestApp, type TestClient } from '../../../test/app.ts'
import { signIn } from '../../../test/auth.ts'
import { openTestDatabase, resetDatabase } from '../../../test/database.ts'
import { listEntityHistory } from '../../data/audit-log.ts'
import type { User } from '../../data/tables.ts'
import { createUser, findUserByEmail, findUserById, setUserStatus } from '../../data/users.ts'
import { routes } from '../../routes.ts'

describe('disable an account (US-0.2.7)', () => {
  let db: Database
  let app: TestApp
  let admin: TestClient
  let member: User
  let memberClient: TestClient

  before(async () => {
    db = await openTestDatabase()
  })
  beforeEach(async () => {
    await resetDatabase(db)
    member = await createUser(db, { name: 'Max Member', email: 'max@example.org' })
    await setUserStatus(db, member.id, 'active')
    app = createTestApp(db, { adminEmails: ['boss@example.org'] })
    admin = app.client()
    await signIn(app, admin, 'boss@example.org')
    memberClient = app.client()
    await signIn(app, memberClient, 'max@example.org')
  })
  after(async () => {
    await db.close()
  })

  it('lists active accounts with a disable button, except the admin themselves', async () => {
    const page = await admin.get(routes.admin.accounts.href())
    const boss = await findUserByEmail(db, 'boss@example.org')

    assert.match(page.text, /Max Member/)
    assert.match(page.text, new RegExp(routes.admin.disableAccount.href({ userId: member.id })))
    assert.doesNotMatch(
      page.text,
      new RegExp(routes.admin.disableAccount.href({ userId: boss?.id ?? '' })),
    )
  })

  it('disables the account, closes its open session at once and logs it', async () => {
    assert.match((await memberClient.get(routes.home.href())).text, /Bonjour Max Member/)

    const response = await admin.post(routes.admin.disableAccount.href({ userId: member.id }))

    assert.equal(response.location, routes.admin.accounts.href())
    assert.equal((await findUserById(db, member.id))?.status, 'disabled')
    assert.doesNotMatch((await memberClient.get(routes.home.href())).text, /Bonjour Max/)
    const [entry] = await listEntityHistory(db, 'user', member.id)
    assert.equal(entry?.action, 'account.disabled')
  })

  it('refuses sign-in links to a disabled account', async () => {
    await admin.post(routes.admin.disableAccount.href({ userId: member.id }))
    const before = app.mailer.outbox.length

    await app.client().post(routes.signIn.form.action.href(), { email: 'max@example.org' })
    assert.equal(app.mailer.outbox.length, before)
  })

  it('refuses disabling to a validated user who is not admin (403)', async () => {
    const other = await createUser(db, { name: 'Other', email: 'other@example.org' })
    await setUserStatus(db, other.id, 'active')

    const response = await memberClient.post(routes.admin.disableAccount.href({ userId: other.id }))
    assert.equal(response.status, 403)
    assert.equal((await findUserById(db, other.id))?.status, 'active')
  })

  it('does not let an admin disable their own account (403)', async () => {
    const boss = await findUserByEmail(db, 'boss@example.org')
    const response = await admin.post(routes.admin.disableAccount.href({ userId: boss?.id ?? '' }))

    assert.equal(response.status, 403)
    assert.equal((await findUserByEmail(db, 'boss@example.org'))?.status, 'active')
  })
})
