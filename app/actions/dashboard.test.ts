import * as assert from 'remix/assert'
import { type Database, sql } from 'remix/data-table'
import { after, before, beforeEach, describe, it } from 'remix/test'

import { createTestApp, type TestApp } from '../../test/app.ts'
import { signIn } from '../../test/auth.ts'
import { createActiveCollectif, createPendingCollectif } from '../../test/collectifs.ts'
import { openTestDatabase, resetDatabase } from '../../test/database.ts'
import { createTestItem } from '../../test/items.ts'
import { createTestLocation } from '../../test/locations.ts'
import { createActiveUser } from '../../test/users.ts'
import { createUser } from '../data/users.ts'
import { routes } from '../routes.ts'
import { recentItemCount } from './controller.tsx'

describe('dashboard (US-0.7.2)', () => {
  let db: Database
  let app: TestApp

  before(async () => {
    db = await openTestDatabase()
  })
  beforeEach(async () => {
    await resetDatabase(db)
    const rita = await createActiveUser(db, 'Rita', 'rita@example.org')
    const otto = await createActiveUser(db, 'Otto', 'otto@example.org')
    await createActiveUser(db, 'Lou', 'lou@example.org')
    const frog = await createActiveCollectif(db, "Collecti'FROG", rita.id)
    const ondes = await createActiveCollectif(db, 'Ondes Courtes', otto.id)
    const local = await createTestLocation(db, { collectifId: frog.id }, 'Local')
    const studio = await createTestLocation(db, { collectifId: ondes.id }, 'Studio')
    for (let n = 1; n <= recentItemCount + 2; n++) {
      const item = await createTestItem(db, {
        locationId: local.id,
        owner: { collectifId: frog.id },
        createdBy: rita.id,
        name: `Objet ${String(n).padStart(2, '0')}`,
      })
      await db.exec(sql`update items set created_at = now() - make_interval(mins => ${100 - n})
        where id = ${item.id}`)
    }
    await createTestItem(db, {
      locationId: studio.id,
      owner: { collectifId: ondes.id },
      createdBy: otto.id,
      name: 'Micro des Ondes',
    })
    app = createTestApp(db, { adminEmails: ['boss@example.org'] })
  })
  after(async () => {
    await db.close()
  })

  async function home(email: string): Promise<string> {
    const client = app.client()
    await signIn(app, client, email)
    return (await client.get(routes.home.href())).text
  }

  it('starts with a search field that searches my collectifs', async () => {
    const html = await home('rita@example.org')
    const form = /<form method="get" action="\/inventaire" class="home-search">(.*?)<\/form>/s.exec(
      html,
    )?.[1]
    assert.ok(form, 'expected the search form')
    assert.match(form, /<label for="recherche-accueil">Chercher dans mes collectifs<\/label>/)
    assert.match(form, /name="q"/)
    assert.ok(html.indexOf('home-search') < html.indexOf('Ajouté récemment'))
  })

  it('lists the newest equipment I may see, and my collectifs with their city and count', async () => {
    const html = await home('rita@example.org')
    const recent = [...html.matchAll(/<strong>(Objet \d\d)<\/strong>/g)].map((m) => m[1])
    assert.equal(recent.length, recentItemCount)
    assert.equal(recent[0], `Objet ${recentItemCount + 2}`)
    assert.doesNotMatch(html, /Micro des Ondes/)
    assert.match(
      html,
      /<strong>Collecti'FROG<\/strong><\/a><br \/><span class="status">Rennes · 10 objets/,
    )
  })

  it('proposes the directory and a new collectif to someone in none', async () => {
    const html = await home('lou@example.org')
    assert.match(html, /Vous ne faites encore partie d’aucun collectif/)
    assert.match(html, /<a href="\/collectifs" class="button">Voir les collectifs<\/a>/)
    assert.match(
      html,
      /<a href="\/collectifs\/nouveau" class="button secondary">Déclarer un collectif/,
    )
    assert.match(html, /Aucun matériel pour l’instant/)
  })

  it('shows admins the pending requests, linked to the queue, and nobody else', async () => {
    await createUser(db, { name: 'Pat', email: 'pat@example.org' })
    await createUser(db, { name: 'Sam', email: 'sam@example.org' })
    const lou = await createActiveUser(db, 'Zoé', 'zoe@example.org')
    await createPendingCollectif(db, 'Nouveau collectif', lou.id)

    const html = await home('boss@example.org')
    assert.match(
      html,
      /<a href="\/admin" class="card pending-card"><span class="pending-count">3<\/span>/,
    )
    assert.match(html, /Demandes à valider/)
    assert.match(html, /2 comptes · 1 collectif/)
    assert.doesNotMatch(await home('rita@example.org'), /pending-card/)
  })

  it('shows a visitor the presentation and the database status', async () => {
    const html = (await app.client().get(routes.home.href())).text
    assert.match(html, /Se connecter/)
    assert.match(html, /Base de données : connectée/)
    assert.doesNotMatch(html, /home-search/)
  })
})
