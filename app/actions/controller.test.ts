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

  it('answers in French and reports a connected database', async () => {
    const router = createTestApp(db).router
    const response = await router.fetch(get(routes.home.href()))

    assert.equal(response.status, 200)
    assert.match(response.headers.get('Content-Type') ?? '', /text\/html/)
    const html = await response.text()
    assert.match(html, /<html lang="fr"/)
    assert.match(html, /Base de données : connectée/)
  })

  it('serves the stylesheet', async () => {
    const router = createTestApp(db).router
    const response = await router.fetch(get('/styles.css'))

    assert.equal(response.status, 200)
  })

  it('stores no session for a visitor who sees no form', async () => {
    const response = await createTestApp(db).router.fetch(get(routes.home.href()))

    assert.equal(response.headers.get('Set-Cookie'), null)
  })
})
