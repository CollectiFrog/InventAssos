import * as assert from 'remix/assert'
import type { Database } from 'remix/data-table'
import { after, before, beforeEach, describe, it } from 'remix/test'

import { createTestApp, testOrigin } from '../../test/app.ts'
import { signIn } from '../../test/auth.ts'
import { openTestDatabase, resetDatabase } from '../../test/database.ts'
import { get } from '../../test/http.ts'
import { createActiveUser } from '../../test/users.ts'
import { routes } from '../routes.ts'

describe('theme switch (ADR 0032)', () => {
  let db: Database

  before(async () => {
    db = await openTestDatabase()
  })
  beforeEach(async () => {
    await resetDatabase(db)
    await createActiveUser(db, 'Camille Martin', 'camille@example.org')
  })
  after(async () => {
    await db.close()
  })

  it('follows the device until the person chooses', async () => {
    const app = createTestApp(db)
    const client = app.client()
    await signIn(app, client, 'camille@example.org')

    const home = await client.get(routes.home.href())
    assert.match(home.text, /<html lang="fr">/)
    assert.match(home.text, /<meta name="color-scheme" content="light dark"/)
    assert.match(home.text, /<button type="submit" name="theme" value="system" aria-pressed="true"/)
  })

  it('stores the choice in a cookie and renders it from the first byte', async () => {
    const app = createTestApp(db)
    const client = app.client()
    await signIn(app, client, 'camille@example.org')

    const response = await client.post(routes.appearance.href(), { theme: 'dark' })
    assert.equal(response.status, 303)
    assert.match(response.headers.get('Set-Cookie') ?? '', /assomatos_theme=dark/)

    const home = await client.get(routes.home.href())
    assert.match(home.text, /<html lang="fr" data-theme="dark">/)
    assert.match(home.text, /<meta name="color-scheme" content="dark"/)
    assert.match(home.text, /value="dark" aria-pressed="true"/)
  })

  it('goes back to the device setting with « Automatique »', async () => {
    const app = createTestApp(db)
    const client = app.client()
    await signIn(app, client, 'camille@example.org')
    await client.post(routes.appearance.href(), { theme: 'light' })

    await client.post(routes.appearance.href(), { theme: 'system' })
    const home = await client.get(routes.home.href())
    assert.match(home.text, /<html lang="fr">/)
  })

  it('sends the person back to the page the switch was on, never off the site', async () => {
    const app = createTestApp(db)
    const client = app.client()
    await signIn(app, client, 'camille@example.org')
    const page = await client.get(routes.inventory.index.href())
    const token = /name="_csrf" value="([^"]+)"/.exec(page.text)?.[1] ?? ''
    const form = (theme: string) => {
      const body = new FormData()
      body.set('_csrf', token)
      body.set('theme', theme)
      return body
    }

    const back = await client.postRaw(routes.appearance.href(), form('dark'), {
      Referer: `${testOrigin}/inventaire?q=lyre`,
    })
    assert.equal(back.location, '/inventaire?q=lyre')

    const away = await client.postRaw(routes.appearance.href(), form('dark'), {
      Referer: 'https://evil.example/inventaire',
    })
    assert.equal(away.location, routes.home.href())
  })

  it('sends a visitor to sign in, without setting anything', async () => {
    const client = createTestApp(db).client()
    const response = await client.post(routes.appearance.href(), { theme: 'dark' })
    assert.equal(response.status, 303)
    assert.match(response.location ?? '', /^\/connexion/)
    assert.equal(response.headers.get('Set-Cookie'), null)
  })
})

describe('design preview /dev/ui (ADR 0032)', () => {
  let db: Database

  before(async () => {
    db = await openTestDatabase()
  })
  after(async () => {
    await db.close()
  })

  it('shows the tokens and components outside production, in the asked theme', async () => {
    const router = createTestApp(db).router
    const response = await router.fetch(get(`${routes.designPreview.href()}?theme=dark`))
    assert.equal(response.status, 200)
    const html = await response.text()
    assert.match(html, /<html lang="fr" data-theme="dark">/)
    assert.match(html, /--bg-canvas/)
    assert.match(html, /class="status-badge status-broken"/)
  })

  it('is not served in production', async () => {
    const router = createTestApp(db).router
    const production = createTestApp(db, { production: true }).router
    assert.equal((await router.fetch(get(routes.designPreview.href()))).status, 200)
    assert.equal((await production.fetch(get(routes.designPreview.href()))).status, 404)
  })
})
