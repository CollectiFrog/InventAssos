import * as assert from 'remix/assert'
import type { Database } from 'remix/data-table'
import { after, before, describe, it } from 'remix/test'
import { openTestDatabase } from '../../test/database.ts'
import { get } from '../../test/http.ts'
import { createAppRouter } from '../router.ts'
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
    const router = createAppRouter({ db })
    const response = await router.fetch(get(routes.home.href()))

    assert.equal(response.status, 200)
    assert.match(response.headers.get('Content-Type') ?? '', /text\/html/)
    const html = await response.text()
    assert.match(html, /<html lang="fr"/)
    assert.match(html, /Base de données : connectée/)
  })

  it('serves the stylesheet', async () => {
    const router = createAppRouter({ db })
    const response = await router.fetch(get('/styles.css'))

    assert.equal(response.status, 200)
  })
})
