import * as assert from 'remix/assert'
import type { Database } from 'remix/data-table'
import { after, before, describe, it } from 'remix/test'

import { createTestApp } from '../../test/app.ts'
import { openTestDatabase } from '../../test/database.ts'
import { get } from '../../test/http.ts'
import { createTestMailer } from '../../test/mailer.ts'
import { createAppRouter } from '../router.ts'
import { routes } from '../routes.ts'

describe('security headers (review F8)', () => {
  let db: Database

  before(async () => {
    db = await openTestDatabase()
  })
  after(async () => {
    await db.close()
  })

  it('sends a script-free CSP that forbids framing on HTML pages', async () => {
    const response = await createTestApp(db).router.fetch(get(routes.signIn.form.index.href()))
    const policy = response.headers.get('Content-Security-Policy') ?? ''

    assert.match(policy, /default-src 'none'/)
    assert.match(policy, /frame-ancestors 'none'/)
    assert.match(policy, /form-action 'self'/)
    assert.match(policy, /style-src 'self'/)
    assert.doesNotMatch(policy, /script-src|unsafe/)
    assert.doesNotMatch(await response.text(), /<script|style="/)
  })

  it('adds nosniff, no framing and a same-origin referrer to every response', async () => {
    const router = createTestApp(db).router
    for (const path of ['/styles.css', routes.health.live.href(), routes.inventory.index.href()]) {
      const response = await router.fetch(get(path))
      assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff', path)
      assert.equal(response.headers.get('X-Frame-Options'), 'DENY', path)
      assert.equal(response.headers.get('Referrer-Policy'), 'same-origin', path)
    }
  })

  it('sends HSTS only when APP_URL is https', async () => {
    const plain = await createTestApp(db).router.fetch(get(routes.health.live.href()))
    assert.equal(plain.headers.get('Strict-Transport-Security'), null)

    const secure = createAppRouter({
      db,
      mailer: createTestMailer(),
      settings: { appUrl: 'https://inv.example.org', adminEmails: new Set() },
      sessionSecret: 'test-secret-test-secret-test-secret',
    })
    const response = await secure.fetch(get(routes.health.live.href()))
    assert.match(response.headers.get('Strict-Transport-Security') ?? '', /^max-age=\d{7,}$/)
  })
})
