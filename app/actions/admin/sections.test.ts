import * as assert from 'remix/assert'
import type { Database } from 'remix/data-table'
import { after, before, beforeEach, describe, it } from 'remix/test'

import { createTestApp, type TestApp, type TestClient } from '../../../test/app.ts'
import { signIn } from '../../../test/auth.ts'
import { createActiveCollectif } from '../../../test/collectifs.ts'
import { openTestDatabase, resetDatabase } from '../../../test/database.ts'
import { createTestItem } from '../../../test/items.ts'
import { createTestLocation } from '../../../test/locations.ts'
import { createActiveUser } from '../../../test/users.ts'
import { createUser } from '../../data/users.ts'
import { routes } from '../../routes.ts'

/** The Administration tabs, the current one starred. */
function tabs(html: string): string[] {
  const nav = /<nav aria-label="Administration" class="tabs">(.*?)<\/nav>/s.exec(html)?.[1] ?? ''
  return [...nav.matchAll(/<a href="([^"]+)"( aria-current="page")?>(.*?)<\/a>/g)].map(
    ([, href, current, label]) => `${current ? '*' : ''}${label} ${href}`,
  )
}

describe('Administration sections at their own URLs (US-0.7.13)', () => {
  let db: Database
  let app: TestApp
  let boss: TestClient

  before(async () => {
    db = await openTestDatabase()
  })
  beforeEach(async () => {
    await resetDatabase(db)
    const rita = await createActiveUser(db, 'Rita', 'rita@example.org')
    await createUser(db, { name: 'Pat', email: 'pat@example.org' })
    const frog = await createActiveCollectif(db, "Collecti'FROG", rita.id)
    const local = await createTestLocation(db, { collectifId: frog.id }, 'Local')
    await createTestItem(db, {
      locationId: local.id,
      owner: { collectifId: frog.id },
      createdBy: rita.id,
    })
    app = createTestApp(db, { adminEmails: ['boss@example.org'] })
    boss = app.client()
    await signIn(app, boss, 'boss@example.org')
  })
  after(async () => {
    await db.close()
  })

  it('shows the requests at /admin and /admin/demandes, the accounts apart', async () => {
    for (const url of [routes.admin.index.href(), routes.admin.requests.href()]) {
      const html = (await boss.get(url)).text
      assert.match(html, /Comptes à valider[\s\S]*Pat/)
      assert.doesNotMatch(html, /Comptes actifs/)
      assert.deepEqual(tabs(html), [
        '*Demandes /admin/demandes',
        'Comptes /admin/comptes',
        'Collectifs /admin/collectifs',
        'Modérateurs /admin/moderateurs',
        'Catégories /admin/categories',
      ])
    }
    const accounts = (await boss.get(routes.admin.accounts.href())).text
    assert.match(accounts, /Comptes actifs[\s\S]*Rita/)
    assert.equal(tabs(accounts)[1], '*Comptes /admin/comptes')
  })

  it('lists the active collectifs with city, responsibles and items, linked to their responsibles', async () => {
    const html = (await boss.get(routes.admin.collectifs.index.href())).text
    assert.match(
      html,
      /<a href="\/collectifs\/collecti-frog\/membres"><strong>Collecti'FROG<\/strong>/,
    )
    assert.match(html, /<td data-label="Ville">Rennes<\/td>/)
    assert.match(html, /<td data-label="Responsables" class="num">1<\/td>/)
    assert.match(html, /<td data-label="Objets" class="num">1<\/td>/)
  })

  it('keeps every section to platform admins', async () => {
    const rita = app.client()
    await signIn(app, rita, 'rita@example.org')
    for (const url of [
      routes.admin.requests.href(),
      routes.admin.accounts.href(),
      routes.admin.collectifs.index.href(),
    ]) {
      assert.equal((await rita.get(url)).status, 403, url)
    }
  })
})
