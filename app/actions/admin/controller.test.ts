import * as assert from 'remix/assert'
import { type Database, sql } from 'remix/data-table'
import { after, before, beforeEach, describe, it } from 'remix/test'

import { createTestApp, type TestApp, type TestClient } from '../../../test/app.ts'
import { signIn } from '../../../test/auth.ts'
import { openTestDatabase, resetDatabase } from '../../../test/database.ts'
import { listEntityHistory } from '../../data/audit-log.ts'
import type { User } from '../../data/tables.ts'
import { createUser, findUserById, setUserStatus } from '../../data/users.ts'
import { routes } from '../../routes.ts'

describe('approve or reject accounts (US-0.2.4)', () => {
  let db: Database
  let app: TestApp
  let admin: TestClient
  let pending: User

  before(async () => {
    db = await openTestDatabase()
  })
  beforeEach(async () => {
    await resetDatabase(db)
    pending = await createUser(db, { name: 'Pat Pending', email: 'pat@example.org' })
    app = createTestApp(db, { adminEmails: ['boss@example.org'] })
    admin = app.client()
    await signIn(app, admin, 'boss@example.org')
    app.mailer.outbox.length = 0
  })
  after(async () => {
    await db.close()
  })

  it('lists pending accounts for the admin', async () => {
    const page = await admin.get(routes.admin.accounts.href())

    assert.equal(page.status, 200)
    assert.match(page.text, /Pat Pending/)
    assert.match(page.text, /pat@example\.org/)
  })

  it('accepts an account, e-mails the person and logs IDs only', async () => {
    const response = await admin.post(routes.admin.approveAccount.href({ userId: pending.id }))

    assert.equal(response.location, routes.admin.accounts.href())
    assert.equal((await findUserById(db, pending.id))?.status, 'active')
    assert.equal(app.mailer.outbox[0]?.to, 'pat@example.org')
    assert.match(app.mailer.outbox[0]?.subject ?? '', /validé/)

    const [entry] = await listEntityHistory(db, 'user', pending.id)
    assert.equal(entry?.action, 'account.approved')
    assert.doesNotMatch(JSON.stringify(entry), /Pat|example\.org/)
    assert.match((await admin.get(routes.admin.accounts.href())).text, /Aucune demande en attente/)
  })

  it('rejects with a reason, e-mails it, and keeps it out of the log', async () => {
    await admin.post(routes.admin.rejectAccount.href({ userId: pending.id }), {
      reason: 'Personne ne connaît Pat Pending',
    })

    const user = await findUserById(db, pending.id)
    assert.equal(user?.status, 'rejected')
    assert.equal(user?.rejection_reason, 'Personne ne connaît Pat Pending')
    assert.match(app.mailer.outbox[0]?.text ?? '', /Motif : Personne ne connaît/)

    const rows = await db.exec(sql`select payload::text as p from audit_log`)
    assert.equal(rows.rows?.length, 1)
    assert.doesNotMatch(String(rows.rows?.[0]?.p), /Pat|Personne/)
  })

  it('rejects without a reason', async () => {
    await admin.post(routes.admin.rejectAccount.href({ userId: pending.id }), { reason: '' })

    assert.equal((await findUserById(db, pending.id))?.rejection_reason, null)
    assert.doesNotMatch(app.mailer.outbox[0]?.text ?? '', /Motif/)
  })

  it('does nothing on an account that is no longer pending', async () => {
    await setUserStatus(db, pending.id, 'active')
    await admin.post(routes.admin.rejectAccount.href({ userId: pending.id }))

    assert.equal((await findUserById(db, pending.id))?.status, 'active')
    assert.equal(app.mailer.outbox.length, 0)
  })

  it('refuses every review action to a validated user who is not admin (403)', async () => {
    const other = await createUser(db, { name: 'Val', email: 'val@example.org' })
    await setUserStatus(db, other.id, 'active')
    const client = app.client()
    await signIn(app, client, 'val@example.org')

    assert.equal((await client.get(routes.admin.accounts.href())).status, 403)
    const approve = await client.post(routes.admin.approveAccount.href({ userId: pending.id }))
    const reject = await client.post(routes.admin.rejectAccount.href({ userId: pending.id }))
    assert.equal(approve.status, 403)
    assert.equal(reject.status, 403)
    assert.equal((await findUserById(db, pending.id))?.status, 'pending')
  })

  it('sends a visitor to sign-in', async () => {
    const response = await app.client().get(routes.admin.accounts.href())

    assert.equal(response.location, routes.signIn.form.index.href())
  })
})
