import * as assert from 'remix/assert'
import type { Database } from 'remix/data-table'
import { after, before, beforeEach, describe, it } from 'remix/test'

import { createTestApp } from '../../../test/app.ts'
import { signIn } from '../../../test/auth.ts'
import { openTestDatabase, resetDatabase } from '../../../test/database.ts'
import { createUser, findUserByEmail, setUserStatus } from '../../data/users.ts'
import { routes } from '../../routes.ts'

const statusUrl = routes.account.status.href()

describe('account under review (US-0.2.3)', () => {
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

  it('redirects a pending user from any page to the status page', async () => {
    await createUser(db, { name: 'Pat', email: 'pat@example.org' })
    const app = createTestApp(db)
    const client = app.client()
    await signIn(app, client, 'pat@example.org')

    for (const path of [routes.home.href(), routes.signUp.form.index.href(), '/nowhere']) {
      const response = await client.get(path)
      assert.equal(response.status, 303, path)
      assert.equal(response.location, statusUrl, path)
    }
    const page = await client.get(statusUrl)
    assert.equal(page.status, 200)
    assert.match(page.text, /en cours d’examen/)
  })

  it('lets a pending user sign out', async () => {
    await createUser(db, { name: 'Pat', email: 'pat@example.org' })
    const app = createTestApp(db)
    const client = app.client()
    await signIn(app, client, 'pat@example.org')

    const response = await client.post(routes.signOut.href())
    assert.equal(response.location, `${routes.home.href()}?deconnexion=ok`)
    assert.equal((await client.get(routes.home.href())).status, 200)
  })

  it('shows the rejection reason and lets the person apply again', async () => {
    const user = await createUser(db, { name: 'Pat', email: 'pat@example.org' })
    await setUserStatus(db, user.id, 'rejected', 'Collectif inconnu')
    const app = createTestApp(db, { adminEmails: ['admin@example.org'] })
    const client = app.client()
    await signIn(app, client, 'pat@example.org')

    assert.equal((await client.get(routes.home.href())).location, statusUrl)
    const page = await client.get(statusUrl)
    assert.match(page.text, /refusée/)
    assert.match(page.text, /Motif : Collectif inconnu/)

    const response = await client.post(routes.account.reapply.href())
    assert.equal(response.location, statusUrl)
    assert.equal((await findUserByEmail(db, 'pat@example.org'))?.status, 'pending')
    assert.deepEqual(app.mailer.outbox.at(-1)?.to, ['admin@example.org'])
  })

  it('does not let a pending user "reapply"', async () => {
    await createUser(db, { name: 'Pat', email: 'pat@example.org' })
    const app = createTestApp(db, { adminEmails: ['admin@example.org'] })
    const client = app.client()
    await signIn(app, client, 'pat@example.org')
    const sent = app.mailer.outbox.length

    await client.post(routes.account.reapply.href())
    assert.equal(app.mailer.outbox.length, sent)
  })

  it('sends an active user home and a visitor to sign-in', async () => {
    const user = await createUser(db, { name: 'Pat', email: 'pat@example.org' })
    await setUserStatus(db, user.id, 'active')
    const app = createTestApp(db)
    const client = app.client()

    assert.equal((await client.get(statusUrl)).location, routes.signIn.form.index.href())
    await signIn(app, client, 'pat@example.org')
    assert.equal((await client.get(statusUrl)).location, routes.home.href())
    assert.equal((await client.get(routes.home.href())).status, 200)
  })
})
