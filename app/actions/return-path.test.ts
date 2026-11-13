import * as assert from 'remix/assert'
import type { Database } from 'remix/data-table'
import { after, before, beforeEach, describe, it } from 'remix/test'

import { createTestApp, type TestApp } from '../../test/app.ts'
import { lastSignInToken } from '../../test/auth.ts'
import { openTestDatabase, resetDatabase } from '../../test/database.ts'
import { createActiveUser } from '../../test/users.ts'
import { routes } from '../routes.ts'
import { safeReturnPath } from './return-path.ts'

describe('safeReturnPath (US-0.7.8)', () => {
  it('keeps a path of this site, with its query', () => {
    assert.equal(safeReturnPath('/materiel/abc?x=1'), '/materiel/abc?x=1')
    assert.equal(safeReturnPath('/inventaire?q=perceuse%20bosch'), '/inventaire?q=perceuse%20bosch')
  })

  it('refuses anything that could lead off the site, or back to sign-in', () => {
    for (const value of [
      null,
      '',
      'materiel',
      'https://evil.example/',
      '//evil.example/x',
      '/.//evil.example',
      '/x/..//evil.example',
      '/%2e//evil.example',
      '/\\evil.example',
      '/a b',
      '/a\tb',
      `/${'a'.repeat(600)}`,
      '/connexion',
      '/connexion/lien/abc',
      '/inscription',
      '/deconnexion',
    ]) {
      assert.equal(safeReturnPath(value), null, String(value))
    }
  })
})

describe('back where I was after signing in (US-0.7.8)', () => {
  let db: Database
  let app: TestApp

  before(async () => {
    db = await openTestDatabase()
  })
  beforeEach(async () => {
    await resetDatabase(db)
    await createActiveUser(db, 'Camille', 'camille@example.org')
    app = createTestApp(db)
  })
  after(async () => {
    await db.close()
  })

  it('lands on the page asked for, through the e-mail link', async () => {
    const client = app.client()
    const wanted = `${routes.inventory.index.href()}?q=perceuse`

    const asked = await client.get(wanted)
    assert.equal(asked.location, `/connexion?suite=${encodeURIComponent(wanted)}`)
    const form = (await client.get(asked.location ?? '')).text
    assert.match(form, /<input type="hidden" name="suite" value="\/inventaire\?q=perceuse"/)

    await client.post(routes.signIn.form.action.href(), {
      email: 'camille@example.org',
      suite: wanted,
    })
    const mail = app.mailer.outbox.at(-1)?.text ?? ''
    assert.match(mail, /\/connexion\/lien\/[\w-]+\?suite=%2Finventaire%3Fq%3Dperceuse/)

    const token = lastSignInToken(app, 'camille@example.org') ?? ''
    const signedIn = await client.get(
      `${routes.signIn.link.href({ token })}?suite=${encodeURIComponent(wanted)}`,
    )
    assert.equal(signedIn.location, wanted)
  })

  it('goes home when the return path is missing or points off the site', async () => {
    for (const suite of ['', '//evil.example/x', 'https://evil.example/']) {
      const client = app.client()
      await client.post(routes.signIn.form.action.href(), { email: 'camille@example.org' })
      const token = lastSignInToken(app, 'camille@example.org') ?? ''
      const response = await client.get(
        `${routes.signIn.link.href({ token })}?suite=${encodeURIComponent(suite)}`,
      )
      assert.equal(response.location, routes.home.href(), suite)
    }
  })

  it('remembers only pages asked for with GET', async () => {
    const response = await app
      .client()
      .post(routes.collectifs.request.action.href(), { name: 'X' }, { csrf: false })
    assert.doesNotMatch(response.location ?? '', /suite=/)
  })
})
