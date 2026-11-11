import * as assert from 'remix/assert'
import type { Database } from 'remix/data-table'
import { after, before, beforeEach, describe, it } from 'remix/test'

import { createTestApp } from '../../test/app.ts'
import { signIn } from '../../test/auth.ts'
import { openTestDatabase, resetDatabase } from '../../test/database.ts'
import { get } from '../../test/http.ts'
import { createUser, setUserStatus } from '../data/users.ts'
import { routes } from '../routes.ts'

describe('sign-out (US-0.2.8)', () => {
  let db: Database

  before(async () => {
    db = await openTestDatabase()
  })
  beforeEach(async () => {
    await resetDatabase(db)
    const user = await createUser(db, { name: 'Camille', email: 'camille@example.org' })
    await setUserStatus(db, user.id, 'active')
  })
  after(async () => {
    await db.close()
  })

  it('shows a sign-out button on the account page (US-0.7.1)', async () => {
    const app = createTestApp(db)
    const client = app.client()
    await signIn(app, client, 'camille@example.org')

    const profile = await client.get(routes.account.profile.index.href())
    assert.match(profile.text, /<form method="post" action="\/deconnexion"[^>]*>.*Se déconnecter/s)
  })

  it('ends the session server side: the old cookie no longer authenticates', async () => {
    const app = createTestApp(db)
    const client = app.client()
    await signIn(app, client, 'camille@example.org')
    const oldCookie = client.cookieHeader()

    const response = await client.post(routes.signOut.href())
    assert.equal(response.status, 303)
    assert.equal(response.location, routes.home.href())

    const replay = await app.router.fetch(get(routes.home.href(), { Cookie: oldCookie }))
    assert.doesNotMatch(await replay.text(), /Bonjour Camille/)
  })

  it('refuses a sign-out without CSRF token', async () => {
    const app = createTestApp(db)
    const client = app.client()
    await signIn(app, client, 'camille@example.org')

    const response = await client.post(routes.signOut.href(), {}, { csrf: false })
    assert.equal(response.status, 403)
    assert.match((await client.get(routes.home.href())).text, /Bonjour Camille/)
  })
})
