import * as assert from 'remix/assert'
import { type Database, sql } from 'remix/data-table'
import { after, before, beforeEach, describe, it } from 'remix/test'

import { createTestApp, testOrigin } from '../../../test/app.ts'
import { lastSignInToken, signIn } from '../../../test/auth.ts'
import { openTestDatabase, resetDatabase } from '../../../test/database.ts'
import { createUser, setUserStatus } from '../../data/users.ts'
import { routes } from '../../routes.ts'

const requestUrl = routes.signIn.form.action.href()

describe('sign-in with an e-mail link (US-0.2.2)', () => {
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

  it('e-mails a link to an existing account', async () => {
    const app = createTestApp(db)
    const response = await app.client().post(requestUrl, { email: 'Camille@example.org' })

    assert.equal(response.status, 303)
    assert.equal(response.location, routes.signIn.sent.href())
    assert.ok(lastSignInToken(app, 'camille@example.org'))
    assert.match(
      app.mailer.outbox[0]?.text ?? '',
      /^http:\/\/inventassos\.test\/connexion\/lien\//m,
    )
  })

  it('answers the same for an unknown e-mail and sends nothing', async () => {
    const app = createTestApp(db)
    const response = await app.client().post(requestUrl, { email: 'nobody@example.org' })

    assert.equal(response.status, 303)
    assert.equal(response.location, routes.signIn.sent.href())
    assert.equal(app.mailer.outbox.length, 0)
  })

  it('sends no link to a disabled account', async () => {
    await db.exec(sql`update users set status = 'disabled'`)
    const app = createTestApp(db)
    await app.client().post(requestUrl, { email: 'camille@example.org' })

    assert.equal(app.mailer.outbox.length, 0)
  })

  it('opening the link only shows a confirmation button', async () => {
    const app = createTestApp(db)
    const client = app.client()
    await client.post(requestUrl, { email: 'camille@example.org' })
    const token = lastSignInToken(app, 'camille@example.org') ?? ''

    // An e-mail scanner opening the link twice must not use it up.
    await client.get(routes.signIn.link.index.href({ token }))
    const page = await client.get(routes.signIn.link.index.href({ token }))
    assert.match(page.text, /Me connecter/)

    const response = await client.post(routes.signIn.link.action.href({ token }))
    assert.equal(response.status, 303)
  })

  it('signs in once with a valid link and regenerates the session', async () => {
    const app = createTestApp(db)
    const client = app.client()
    await client.post(requestUrl, { email: 'camille@example.org' })
    const token = lastSignInToken(app, 'camille@example.org') ?? ''
    const before = (await client.get(routes.signIn.link.index.href({ token }))).headers
      .get('Set-Cookie')
      ?.split(';')[0]

    const response = await client.post(routes.signIn.link.action.href({ token }))
    const after = response.headers.get('Set-Cookie')?.split(';')[0]

    assert.equal(response.status, 303)
    assert.equal(response.location, routes.home.href())
    assert.notEqual(after, before)
    assert.match((await client.get(routes.home.href())).text, /Bonjour Camille/)

    const again = await app.client().post(routes.signIn.link.action.href({ token }))
    assert.equal(again.status, 400)
    assert.match(again.text, /Ce lien ne fonctionne plus/)
  })

  it('gives a new CSRF token at sign-in: the token from before no longer works', async () => {
    const app = createTestApp(db)
    const client = app.client()
    const form = await client.get(requestUrl)
    const before = /name="_csrf" value="([^"]+)"/.exec(form.text)?.[1] ?? ''
    await client.post(requestUrl, { email: 'camille@example.org' })
    const token = lastSignInToken(app, 'camille@example.org') ?? ''
    await client.post(routes.signIn.link.action.href({ token }))

    const home = await client.get(routes.home.href())
    const now = /name="_csrf" value="([^"]+)"/.exec(home.text)?.[1] ?? ''
    assert.ok(before !== '' && now !== '')
    assert.notEqual(now, before)
    const body = new FormData()
    body.set('_csrf', before)
    const stale = await app.router.fetch(
      new Request(new URL(routes.signOut.href(), testOrigin), {
        method: 'POST',
        body,
        headers: { Cookie: client.cookieHeader(), Origin: testOrigin },
      }),
    )
    assert.equal(stale.status, 403)
  })

  it('creates no session row for visitors, however many forms they open', async () => {
    const app = createTestApp(db)
    for (let i = 0; i < 20; i++) await app.client().get(requestUrl)
    await app.client().get(routes.signUp.form.index.href())

    const rows = await db.exec(sql`select count(*)::int as n from sessions`)
    assert.equal(rows.rows?.[0]?.n, 0)
  })

  it('refuses an expired link', async () => {
    const app = createTestApp(db)
    const client = app.client()
    await client.post(requestUrl, { email: 'camille@example.org' })
    const token = lastSignInToken(app, 'camille@example.org') ?? ''
    await db.exec(sql`update sign_in_tokens set expires_at = now() - interval '1 second'`)

    const response = await client.post(routes.signIn.link.action.href({ token }))
    assert.equal(response.status, 400)
  })

  it('refuses an unknown link', async () => {
    const response = await createTestApp(db)
      .client()
      .post(routes.signIn.link.action.href({ token: 'not-a-real-token' }))

    assert.equal(response.status, 400)
  })

  it('refuses a valid link once the account is disabled', async () => {
    const app = createTestApp(db)
    const client = app.client()
    await client.post(requestUrl, { email: 'camille@example.org' })
    const token = lastSignInToken(app, 'camille@example.org') ?? ''
    await db.exec(sql`update users set status = 'disabled'`)

    const response = await client.post(routes.signIn.link.action.href({ token }))
    assert.equal(response.status, 400)
  })

  it('signs a disabled account out on its next request', async () => {
    const app = createTestApp(db)
    const client = app.client()
    await signIn(app, client, 'camille@example.org')
    await db.exec(sql`update users set status = 'disabled'`)

    const home = await client.get(routes.home.href())
    assert.doesNotMatch(home.text, /Bonjour Camille/)
  })
})
