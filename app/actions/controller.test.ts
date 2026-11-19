import * as assert from 'remix/assert'
import type { Database } from 'remix/data-table'
import { after, before, describe, it } from 'remix/test'
import { createTestApp } from '../../test/app.ts'
import { openTestDatabase } from '../../test/database.ts'
import { get } from '../../test/http.ts'
import { routes } from '../routes.ts'

describe('home page', () => {
  let db: Database

  before(async () => {
    db = await openTestDatabase()
  })

  after(async () => {
    await db.close()
  })

  it('answers in French, with no technical status when the database answers', async () => {
    const router = createTestApp(db).router
    const response = await router.fetch(get(routes.home.href()))

    assert.equal(response.status, 200)
    assert.match(response.headers.get('Content-Type') ?? '', /text\/html/)
    const html = await response.text()
    assert.match(html, /<html lang="fr"/)
    assert.doesNotMatch(html, /Base de données|indisponible/)
  })

  it('serves the stylesheet', async () => {
    const router = createTestApp(db).router
    const response = await router.fetch(get('/styles.css'))

    assert.equal(response.status, 200)
  })

  it('shows visitors the landing page: the promise, join, sign in, the code and the legal notice', async () => {
    const response = await createTestApp(db).router.fetch(get(routes.home.href()))
    const html = await response.text()

    assert.match(html, /<h1>À plusieurs, on a déjà tout le matériel\.<\/h1>/)
    assert.match(html, /Qui a quoi \? Où est-il \? Puis-je l’utiliser samedi \?/)
    assert.match(html, /<link rel="stylesheet" href="\/landing\.css" \/>/)
    assert.match(html, /<link rel="stylesheet" href="\/landing-scene\.css" \/>/)
    assert.match(html, /<svg [^>]*aria-hidden="true"[^>]*class="landing-art"/)
    assert.match(html, /href="https:\/\/github\.com\/CollectiFrog\/InventAssos"/)
    assert.match(html, /<a href="\/mentions-legales">Mentions légales<\/a>/)
  })

  it('serves the landing page’s stylesheets and logo', async () => {
    const router = createTestApp(db).router
    for (const path of ['/landing.css', '/landing-scene.css', '/logo.svg']) {
      const response = await router.fetch(get(path))
      assert.equal(response.status, 200, path)
    }
  })

  it('opens the legal notice to visitors, as a page under construction', async () => {
    const response = await createTestApp(db).router.fetch(get(routes.legal.href()))

    assert.equal(response.status, 200)
    const html = await response.text()
    assert.match(html, /<h1>Mentions légales<\/h1>/)
    assert.match(html, /en cours de construction/)
  })

  it('stores no session for a visitor who sees no form', async () => {
    const response = await createTestApp(db).router.fetch(get(routes.home.href()))

    assert.equal(response.headers.get('Set-Cookie'), null)
  })
})
