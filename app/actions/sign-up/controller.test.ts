import * as assert from 'remix/assert'
import type { Database } from 'remix/data-table'
import { after, before, beforeEach, describe, it } from 'remix/test'

import { createTestApp } from '../../../test/app.ts'
import { openTestDatabase, resetDatabase } from '../../../test/database.ts'
import { createUser, findUserByEmail, setUserStatus } from '../../data/users.ts'
import { routes } from '../../routes.ts'

const signUpUrl = routes.signUp.form.action.href()

describe('sign-up (US-0.2.1)', () => {
  let db: Database

  before(async () => {
    db = await openTestDatabase()
  })
  beforeEach(async () => {
    await resetDatabase(db)
  })
  after(async () => {
    await db.close()
  })

  it('shows the form with a CSRF token', async () => {
    const response = await createTestApp(db).client().get(routes.signUp.form.index.href())

    assert.equal(response.status, 200)
    assert.match(response.text, /Créer un compte/)
    assert.match(response.text, /name="_csrf" value="[^"]+"/)
  })

  it('creates a pending account, e-mails the person and the admins', async () => {
    const app = createTestApp(db, { adminEmails: ['admin@example.org'] })
    const response = await app
      .client()
      .post(signUpUrl, { name: '  Camille Dupont ', email: 'Camille@Example.org' })

    assert.equal(response.status, 303)
    assert.equal(response.location, routes.signUp.sent.href())

    const user = await findUserByEmail(db, 'camille@example.org')
    assert.equal(user?.status, 'pending')
    assert.equal(user?.name, 'Camille Dupont')
    assert.equal(user?.email, 'camille@example.org')

    assert.deepEqual(
      app.mailer.outbox.map((mail) => mail.to),
      ['camille@example.org', ['admin@example.org']],
    )
  })

  it('refuses a second sign-up with the same e-mail without revealing it', async () => {
    await createUser(db, { name: 'Camille', email: 'camille@example.org' })
    const app = createTestApp(db, { adminEmails: ['admin@example.org'] })

    const response = await app
      .client()
      .post(signUpUrl, { name: 'Other', email: 'CAMILLE@example.org' })

    // Same redirect as a new sign-up: the form does not tell whether the e-mail exists.
    assert.equal(response.status, 303)
    assert.equal(response.location, routes.signUp.sent.href())
    const user = await findUserByEmail(db, 'camille@example.org')
    assert.equal(user?.name, 'Camille')
    assert.equal(app.mailer.outbox.length, 1)
    assert.equal(app.mailer.outbox[0]?.to, 'camille@example.org')
    assert.match(app.mailer.outbox[0]?.subject ?? '', /déjà un compte/)
  })

  it('leaves a rejected account rejected: only its owner may re-apply, once signed in', async () => {
    const rejected = await createUser(db, { name: 'Camille', email: 'camille@example.org' })
    await setUserStatus(db, rejected.id, 'rejected', 'Inconnu')
    const app = createTestApp(db, { adminEmails: ['admin@example.org'] })

    await app.client().post(signUpUrl, { name: 'Camille', email: 'camille@example.org' })

    const user = await findUserByEmail(db, 'camille@example.org')
    assert.equal(user?.status, 'rejected')
    assert.equal(user?.rejection_reason, 'Inconnu')
    assert.deepEqual(
      app.mailer.outbox.map((mail) => mail.to),
      ['camille@example.org'],
    )
    assert.match(app.mailer.outbox[0]?.text ?? '', /connectez-vous[\s\S]*\/connexion/)
  })

  it('shows French errors for invalid input and creates nothing', async () => {
    const response = await createTestApp(db).client().post(signUpUrl, { name: ' ', email: 'nope' })

    assert.equal(response.status, 400)
    assert.match(response.text, /Ce champ est obligatoire/)
    assert.match(response.text, /Adresse e-mail invalide/)
    assert.match(response.text, /value="nope"/)
    assert.equal(await findUserByEmail(db, 'nope'), null)
  })

  it('rejects a post without a CSRF token', async () => {
    const response = await createTestApp(db)
      .client()
      .post(signUpUrl, { name: 'Camille', email: 'camille@example.org' }, { csrf: false })

    assert.equal(response.status, 403)
    assert.equal(await findUserByEmail(db, 'camille@example.org'), null)
  })
})
