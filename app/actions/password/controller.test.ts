import * as assert from 'remix/assert'
import { type Database, sql } from 'remix/data-table'
import { after, before, beforeEach, describe, it } from 'remix/test'

import { createTestApp, type TestApp, type TestClient } from '../../../test/app.ts'
import { lastPasswordToken, lastSignInToken, signIn } from '../../../test/auth.ts'
import { openTestDatabase, resetDatabase } from '../../../test/database.ts'
import { listEntityHistory } from '../../data/audit-log.ts'
import type { User } from '../../data/tables.ts'
import { createUser, findUserById, setUserStatus } from '../../data/users.ts'
import { defaultRateLimits } from '../../rate-limits.ts'
import { routes } from '../../routes.ts'

const email = 'camille@example.org'
const password = 'une phrase assez longue'

describe('password sign-in (US-0.10.8)', () => {
  let db: Database
  let app: TestApp
  let camille: User

  before(async () => {
    db = await openTestDatabase()
  })
  beforeEach(async () => {
    await resetDatabase(db)
    camille = await createUser(db, { name: 'Camille', email })
    await setUserStatus(db, camille.id, 'active')
    app = createTestApp(db)
  })
  after(async () => {
    await db.close()
  })

  /** Asks for a password link and returns its token. */
  async function askLink(client: TestClient = app.client()): Promise<string> {
    const response = await client.post(routes.password.request.action.href(), { email })
    assert.equal(response.location, routes.password.sent.href())
    const token = lastPasswordToken(app, email)
    assert.ok(token, 'expected a password e-mail')
    return token
  }

  /** Chooses `password` through a fresh link, on `client`. */
  async function choose(client: TestClient = app.client()): Promise<void> {
    const token = await askLink(client)
    const response = await client.post(routes.password.choose.action.href({ token }), {
      password,
      confirmation: password,
    })
    assert.equal(response.status, 303)
  }

  function signInWithPassword(client: TestClient, value: string, extra = {}) {
    return client.post(routes.signIn.password.href(), { email, password: value, ...extra })
  }

  it('chooses a password from the e-mailed link and signs in, logging it with IDs only', async () => {
    const client = app.client()
    const token = await askLink(client)
    // Opening the link only shows the form: a mail scanner cannot use it up.
    const form = await client.get(routes.password.choose.index.href({ token }))
    assert.equal(form.status, 200)
    assert.match(form.text, /Nouveau mot de passe/)

    const response = await client.post(routes.password.choose.action.href({ token }), {
      password,
      confirmation: password,
    })
    assert.equal(response.location, routes.home.href())
    assert.match((await client.get(routes.home.href())).text, /Bonjour Camille/)
    assert.match((await findUserById(db, camille.id))?.password_hash ?? '', /^scrypt\$/)
    const [entry] = await listEntityHistory(db, 'user', camille.id)
    assert.equal(entry?.action, 'user.password_set')
    assert.doesNotMatch(JSON.stringify(entry), /camille@|phrase/)
    const changed = app.mailer.outbox.findLast((m) => /a été modifié/.test(m.subject))
    assert.equal(changed?.to, email)
  })

  it('signs in with the password, and lands on the page asked for', async () => {
    await choose()
    const client = app.client()
    const wanted = routes.inventory.index.href()
    const response = await signInWithPassword(client, password, { suite: wanted })
    assert.equal(response.status, 303)
    assert.equal(response.location, wanted)
    assert.match((await client.get(routes.home.href())).text, /Bonjour Camille/)
  })

  it('answers the same for a wrong password, an unknown address or no password yet', async () => {
    const noPassword = await signInWithPassword(app.client(), password)
    await choose()
    const wrong = await signInWithPassword(app.client(), 'pas le bon mot de passe')
    const unknown = await app
      .client()
      .post(routes.signIn.password.href(), { email: 'nobody@example.org', password })
    for (const response of [noPassword, wrong, unknown]) {
      assert.equal(response.status, 400)
      assert.match(response.text, /Adresse e-mail ou mot de passe incorrect/)
      assert.doesNotMatch(response.text, /une phrase assez longue|pas le bon/)
    }
  })

  it('refuses the right password once the account is disabled', async () => {
    await choose()
    await setUserStatus(db, camille.id, 'disabled')
    const response = await signInWithPassword(app.client(), password)
    assert.equal(response.status, 400)
  })

  it('asks for the password, or the link button, when the field is empty', async () => {
    const response = await signInWithPassword(app.client(), '')
    assert.equal(response.status, 400)
    assert.match(response.text, /Saisissez votre mot de passe, ou recevez un lien/)
  })

  it('keeps the e-mail link: the second button posts the same form to the link request', async () => {
    const page = (await app.client().get(routes.signIn.form.index.href())).text
    assert.match(page, new RegExp(`action="${routes.signIn.password.href()}"`))
    assert.match(page, new RegExp(`formaction="${routes.signIn.form.action.href()}"`))
    assert.match(page, /type="password"/)
  })

  it('stops after 10 tries an hour for one address, right or wrong', async () => {
    await choose()
    app = createTestApp(db, {
      rateLimits: { ...defaultRateLimits, formsPerClient: { limit: 1000, windowSeconds: 60 } },
    })
    for (let i = 0; i < 10; i++) await signInWithPassword(app.client(), 'pas le bon mot de passe')
    const blocked = await signInWithPassword(app.client(), password)
    assert.equal(blocked.status, 429)
    assert.match(blocked.text, /Trop d’essais pour cette adresse/)
  })

  it('refuses a short password or a different confirmation, and keeps the link usable', async () => {
    const client = app.client()
    const token = await askLink(client)
    const url = routes.password.choose.action.href({ token })
    const short = await client.post(url, { password: 'court', confirmation: 'court' })
    assert.equal(short.status, 400)
    assert.match(short.text, /au moins 12 caractères/)
    const different = await client.post(url, { password, confirmation: `${password}!` })
    assert.equal(different.status, 400)
    assert.match(different.text, /ne sont pas les mêmes/)
    assert.equal((await client.post(url, { password, confirmation: password })).status, 303)
  })

  it('uses a link once, and the newest link closes the older ones', async () => {
    const older = await askLink()
    const newer = await askLink()
    const client = app.client()
    const url = routes.password.choose.action.href({ token: newer })
    await client.post(url, { password, confirmation: password })

    for (const token of [newer, older]) {
      const again = await app
        .client()
        .post(routes.password.choose.action.href({ token }), { password, confirmation: password })
      assert.equal(again.status, 400)
      assert.match(again.text, /Ce lien ne fonctionne plus/)
      const opened = await app.client().get(routes.password.choose.index.href({ token }))
      assert.equal(opened.status, 400)
    }
  })

  it('refuses an expired link', async () => {
    const token = await askLink()
    await db.exec(sql`update sign_in_tokens set expires_at = now() - interval '1 second'`)
    const response = await app
      .client()
      .post(routes.password.choose.action.href({ token }), { password, confirmation: password })
    assert.equal(response.status, 400)
  })

  it('never takes a password link as a sign-in link, nor the reverse', async () => {
    const token = await askLink()
    const asSignIn = await app.client().get(routes.signIn.link.href({ token }))
    assert.equal(asSignIn.status, 400)

    await app.client().post(routes.signIn.form.action.href(), { email })
    const signInToken = lastSignInToken(app, email) ?? ''
    const asPassword = await app
      .client()
      .post(routes.password.choose.action.href({ token: signInToken }), {
        password,
        confirmation: password,
      })
    assert.equal(asPassword.status, 400)
    assert.equal((await findUserById(db, camille.id))?.password_hash, null)
  })

  it('closes every other session when the password changes', async () => {
    const elsewhere = app.client()
    await signIn(app, elsewhere, email)
    assert.match((await elsewhere.get(routes.home.href())).text, /Bonjour Camille/)
    await choose()
    assert.doesNotMatch((await elsewhere.get(routes.home.href())).text, /Bonjour Camille/)
  })

  it('answers the same for an unknown address and sends nothing', async () => {
    const response = await app
      .client()
      .post(routes.password.request.action.href(), { email: 'nobody@example.org' })
    assert.equal(response.location, routes.password.sent.href())
    assert.equal(app.mailer.outbox.length, 0)
  })

  it('sends no password link to a disabled account', async () => {
    await setUserStatus(db, camille.id, 'disabled')
    await app.client().post(routes.password.request.action.href(), { email })
    assert.equal(app.mailer.outbox.length, 0)
  })

  it('lets a pending account choose a password; it then lands on its status page', async () => {
    await setUserStatus(db, camille.id, 'pending')
    const client = app.client()
    await choose(client)
    const home = await client.get(routes.home.href())
    assert.equal(home.location, routes.account.status.href())
  })

  it('offers « Choisir un mot de passe » in Mon compte, then « Changer » once chosen', async () => {
    const client = app.client()
    await signIn(app, client, email)
    const before = (await client.get(routes.account.profile.index.href())).text
    assert.match(before, /Vous n’avez pas encore de mot de passe/)
    assert.match(before, />Choisir un mot de passe</)
    await choose(client)
    const after = (await client.get(routes.account.profile.index.href())).text
    assert.match(after, /Vous avez un mot de passe\./)
    assert.match(after, />Changer mon mot de passe</)
  })
})
