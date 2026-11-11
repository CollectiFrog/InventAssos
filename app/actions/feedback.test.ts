import * as assert from 'remix/assert'
import type { Database } from 'remix/data-table'
import { after, before, beforeEach, describe, it } from 'remix/test'

import { createTestApp, type TestApp } from '../../test/app.ts'
import { signIn } from '../../test/auth.ts'
import { openTestDatabase, resetDatabase } from '../../test/database.ts'
import { createActiveUser } from '../../test/users.ts'
import { routes } from '../routes.ts'

describe('clear feedback (US-0.7.7)', () => {
  let db: Database
  let app: TestApp

  before(async () => {
    db = await openTestDatabase()
  })
  beforeEach(async () => {
    await resetDatabase(db)
    await createActiveUser(db, 'Camille', 'camille@example.org')
    app = createTestApp(db, { adminEmails: ['boss@example.org'] })
  })
  after(async () => {
    await db.close()
  })

  it('confirms the sign-out', async () => {
    const client = app.client()
    await signIn(app, client, 'camille@example.org')
    const response = await client.post(routes.signOut.href())
    assert.equal(response.status, 303, response.text.slice(0, 200))
    const home = (await client.get(response.location ?? '')).text
    assert.match(home, /<p [^>]*role="status"[^>]*>Vous êtes déconnecté/)
    assert.doesNotMatch((await app.client().get(routes.home.href())).text, /Vous êtes déconnecté/)
  })

  it('confirms moving a category', async () => {
    const boss = app.client()
    await signIn(app, boss, 'boss@example.org')
    await boss.post(routes.admin.categories.down.href({ categoryId: 'sound' }))
    const page = (await boss.get(routes.admin.categories.index.href())).text
    assert.match(page, /« Son » descend d’une place\./)
  })

  it('proposes the next action when Rechercher has nothing, and a way out of a dead-end search', async () => {
    const client = app.client()
    await signIn(app, client, 'camille@example.org')
    const empty = (await client.get(routes.inventory.index.href())).text
    assert.match(empty, /<a href="\/materiel\/nouveau" class="button">Ajouter du matériel<\/a>/)
    assert.match(empty, /Voir les collectifs/)
    const none = (await client.get(`${routes.inventory.index.href()}?q=introuvable`)).text
    assert.match(none, /Aucun objet ne correspond à cette recherche/)
    assert.match(none, /<a href="\/inventaire" class="button secondary">Tout afficher<\/a>/)
  })

  it('recalls owner and location last, right above « Ajouter »', async () => {
    const client = app.client()
    await signIn(app, client, 'camille@example.org')
    const form = (await client.get(routes.items.create.index.href())).text
    const recap = form.indexOf('<legend>Vérifiez avant d’ajouter</legend>')
    assert.ok(recap > form.indexOf('name="name"'), 'after the item fields')
    assert.ok(form.indexOf('name="locationId"') > recap)
    assert.ok(form.indexOf('name="owner"') > recap)
    assert.ok(form.indexOf('<button type="submit">Ajouter</button>') > form.indexOf('name="owner"'))
  })
})
