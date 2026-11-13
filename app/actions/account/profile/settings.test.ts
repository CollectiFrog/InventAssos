import * as assert from 'remix/assert'
import type { Database } from 'remix/data-table'
import { after, before, beforeEach, describe, it } from 'remix/test'

import { createTestApp, type TestApp, type TestClient } from '../../../../test/app.ts'
import { signIn } from '../../../../test/auth.ts'
import { createActiveCollectif } from '../../../../test/collectifs.ts'
import { openTestDatabase, resetDatabase } from '../../../../test/database.ts'
import { createActiveUser } from '../../../../test/users.ts'
import { findUserByEmail } from '../../../data/users.ts'
import { routes } from '../../../routes.ts'

describe('Mon compte as a settings page (US-0.7.13)', () => {
  let db: Database
  let app: TestApp
  let camille: TestClient

  before(async () => {
    db = await openTestDatabase()
  })
  beforeEach(async () => {
    await resetDatabase(db)
    const user = await createActiveUser(db, 'Camille', 'camille@example.org')
    await createActiveCollectif(db, "Collecti'FROG", user.id)
    app = createTestApp(db)
    camille = app.client()
    await signIn(app, camille, 'camille@example.org')
  })
  after(async () => {
    await db.close()
  })

  it('lists its sections in contents, the danger zone last', async () => {
    const html = (await camille.get(routes.account.profile.index.href())).text
    const toc = /<nav aria-label="Sur cette page"[^>]*>(.*?)<\/nav>/s.exec(html)?.[1] ?? ''
    assert.deepEqual(
      [...toc.matchAll(/href="#([^"]+)"/g)].map((m) => m[1]),
      ['profil', 'collectifs', 'mot-de-passe', 'session', 'a-propos', 'supprimer'],
    )
    for (const id of ['profil', 'collectifs', 'mot-de-passe', 'session', 'a-propos', 'supprimer']) {
      assert.match(html, new RegExp(`<section id="${id}"[^>]*class="setting"`))
    }
    assert.match(html, /<a href="\/collectifs\/collecti-frog">Collecti'FROG<\/a>/)
    assert.match(html, /<div class="card danger-zone"><p><a href="\/compte\/supprimer">/)
  })

  it('explains deletion at /compte/supprimer, and deletes nothing before V1.0', async () => {
    const page = await camille.get(routes.account.deletion.href())
    assert.equal(page.status, 200)
    assert.match(page.text, /arrive avec la version 1\.0/)
    assert.doesNotMatch(page.text, /<form method="post"[^>]*supprimer/)
    assert.equal((await findUserByEmail(db, 'camille@example.org'))?.status, 'active')
  })

  it('keeps the deletion page to signed-in people', async () => {
    const visitor = await app.client().get(routes.account.deletion.href())
    assert.match(visitor.location ?? '', /^\/connexion\?suite=%2Fcompte%2Fsupprimer$/)
  })
})
