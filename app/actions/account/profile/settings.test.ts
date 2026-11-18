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

  it('lists one row per setting in one column, deletion last (ADR 0034)', async () => {
    const html = (await camille.get(routes.account.profile.index.href())).text
    assert.doesNotMatch(html, /Sur cette page|class="settings/)
    assert.deepEqual(
      [...html.matchAll(/<(?:div|form) id="([^"]+)"[^>]*class="setting-row[" ]/g)].map((m) => m[1]),
      [
        'e-mail',
        'nom',
        'telephone',
        'apparence',
        'collectifs',
        'mot-de-passe',
        'session',
        'supprimer',
      ],
    )
    assert.match(html, /<a href="\/collectifs\/collecti-frog">Collecti'FROG<\/a>/)
    assert.match(html, /<a href="\/compte\/supprimer" class="button danger small">Supprimer…<\/a>/)
    assert.match(html, /<p id="a-propos" class="setting-foot">/)
  })

  it('edits a field in its own row: a pencil, then the field with ✓ and ✕', async () => {
    const page = routes.account.profile.index.href()
    const html = (await camille.get(page)).text
    assert.doesNotMatch(html, /<form id="(nom|telephone)"|<input id="field-/)
    assert.match(
      html,
      /<a href="\/compte\/profil\?modifier=nom#nom" title="Modifier : nom et prénom"/,
    )
    assert.match(
      html,
      /<a href="\/compte\/profil\?modifier=telephone#telephone" title="Modifier : téléphone"/,
    )

    const editing = (await camille.get(`${page}?modifier=telephone`)).text
    const row = /<form id="telephone"[^>]*>(.*?)<\/form>/s.exec(editing)?.[1] ?? ''
    assert.match(row, /<label for="field-phone" class="setting-label">Téléphone/)
    assert.match(row, /<input id="field-phone" name="phone" type="tel"[^>]*autofocus/)
    assert.match(row, /<button type="submit" title="Enregistrer" class="icon-button">/)
    assert.match(
      row,
      /<a href="\/compte\/profil" title="Annuler" class="button secondary icon-button">/,
    )
    // Only that row changes; an unknown row name changes none.
    assert.match(editing, /<div id="nom" class="setting-row">/)
    const unknown = (await camille.get(`${page}?modifier=supprimer`)).text
    assert.doesNotMatch(unknown, /<form id="/)
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
