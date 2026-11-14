import * as assert from 'remix/assert'
import type { Database } from 'remix/data-table'
import { after, before, beforeEach, describe, it } from 'remix/test'

import { createTestApp } from '../../test/app.ts'
import { signIn } from '../../test/auth.ts'
import { createActiveCollectif } from '../../test/collectifs.ts'
import { openTestDatabase, resetDatabase } from '../../test/database.ts'
import { createActiveUser } from '../../test/users.ts'
import type { User } from '../data/tables.ts'
import { createUser } from '../data/users.ts'
import { routes } from '../routes.ts'
import { initialsOf } from './layout.tsx'

/** The main navigation of a page, or null when it has none. */
function mainNav(html: string): string | null {
  return /<nav aria-label="Navigation principale"[^>]*>(.*?)<\/nav>/s.exec(html)?.[1] ?? null
}

/** The "Mes collectifs" shortcuts of the sidebar, as "label href", or null when absent. */
function myCollectifs(html: string): string[] | null {
  const nav = /<nav aria-labelledby="mes-collectifs"[^>]*>(.*?)<\/nav>/s.exec(html)?.[1]
  if (nav === undefined) return null
  return [...nav.matchAll(/<a href="([^"]+)".*?<\/span><span>(.*?)<\/span><\/a>/gs)].map(
    ([, href, label]) => `${label} ${href}`,
  )
}

/** Labels of the entries marked as current in the main navigation. */
function currentEntries(html: string): string[] {
  const nav = mainNav(html) ?? ''
  return [...nav.matchAll(/<a [^>]*aria-current="page"[^>]*>.*?<span>(.*?)<\/span><\/a>/gs)].map(
    (match) => match[1] ?? '',
  )
}

describe('navigation (US-0.7.1, ADR 0022)', () => {
  let db: Database
  let camille: User

  before(async () => {
    db = await openTestDatabase()
  })
  beforeEach(async () => {
    await resetDatabase(db)
    camille = await createActiveUser(db, 'Camille Martin', 'camille@example.org')
  })
  after(async () => {
    await db.close()
  })

  it('gives a validated user the four entries, in order, with their URLs', async () => {
    const app = createTestApp(db)
    const client = app.client()
    await signIn(app, client, 'camille@example.org')

    const nav = mainNav((await client.get(routes.home.href())).text)
    assert.ok(nav, 'expected the main navigation')
    const links = [...nav.matchAll(/<a href="([^"]+)".*?<span>(.*?)<\/span>/gs)].map(
      ([, href, label]) => `${label} ${href}`,
    )
    assert.deepEqual(links, [
      'Accueil /',
      'Rechercher /inventaire',
      'Mon matériel /materiel',
      'Collectifs /collectifs',
    ])
  })

  it('marks the entry of the current section, and only that one', async () => {
    const app = createTestApp(db)
    const client = app.client()
    await signIn(app, client, 'camille@example.org')

    const expected: [string, string][] = [
      [routes.home.href(), 'Accueil'],
      [routes.inventory.index.href(), 'Rechercher'],
      [routes.items.index.href(), 'Mon matériel'],
      [routes.items.create.index.href(), 'Mon matériel'],
      [routes.locations.index.href(), 'Mon matériel'],
      [routes.collectifs.index.href(), 'Collectifs'],
      [routes.collectifs.request.index.href(), 'Collectifs'],
    ]
    for (const [url, label] of expected) {
      const page = await client.get(url)
      assert.equal(page.status, 200, url)
      assert.deepEqual(currentEntries(page.text), [label], url)
    }
  })

  it('gives Mon matériel two tabs, Matériel and Lieux, each marked on its page', async () => {
    const app = createTestApp(db)
    const client = app.client()
    await signIn(app, client, 'camille@example.org')

    const tabs = (html: string) =>
      /<nav aria-label="Mon matériel" class="tabs">(.*?)<\/nav>/s.exec(html)?.[1] ?? ''
    const items = tabs((await client.get(routes.items.index.href())).text)
    assert.match(items, /<a href="\/materiel" aria-current="page">Matériel<\/a>/)
    assert.match(items, /<a href="\/lieux">Lieux<\/a>/)
    const places = tabs((await client.get(routes.locations.index.href())).text)
    assert.match(places, /<a href="\/lieux" aria-current="page">Lieux<\/a>/)
  })

  it('puts the account in the header with initials, and marks it on the profile page', async () => {
    const app = createTestApp(db)
    const client = app.client()
    await signIn(app, client, 'camille@example.org')

    const home = (await client.get(routes.home.href())).text
    assert.match(
      home,
      /<a href="\/compte\/profil" aria-label="CM, mon compte : Camille Martin"[^>]*>CM<\/a>/,
    )
    assert.doesNotMatch(home, /Administration/)

    const profile = (await client.get(routes.account.profile.index.href())).text
    assert.match(profile, /<a href="\/compte\/profil" aria-label="[^"]*" aria-current="page"/)
    assert.deepEqual(currentEntries(profile), [])
    assert.match(profile, /Se déconnecter/)
  })

  it('puts Administration in Mon compte for staff only, never in the navigation (ADR 0030)', async () => {
    const app = createTestApp(db, { adminEmails: ['boss@example.org'] })
    const client = app.client()
    await signIn(app, client, 'boss@example.org')

    const home = (await client.get(routes.home.href())).text
    assert.doesNotMatch(home, /<aside class="sidebar">.*?Administration.*?<\/aside>/s)
    assert.doesNotMatch(home, /<header class="top-bar">.*?Administration.*?<\/header>/s)
    const profile = (await client.get(routes.account.profile.index.href())).text
    assert.match(profile, /<a href="#administration" class="toc-link">Administration<\/a>/)
    assert.match(profile, /<section id="administration"[\s\S]*?Aucune demande en attente\./)
    assert.match(profile, /<a href="\/admin" class="button secondary">Ouvrir l’administration<\/a>/)
    // The admin pages lead back to Mon compte and mark it as the current shell link.
    const queue = (await client.get(routes.admin.index.href())).text
    assert.match(queue, /<a href="\/compte\/profil" aria-label="[^"]*" aria-current="page"/)
    assert.match(queue, /<a href="\/compte\/profil#administration" class="back-link">/)
    assert.match(queue, /<a href="\/compte\/profil#administration" class="crumb-link">Mon compte/)
  })

  it('counts the pending requests in Mon compte › Administration', async () => {
    const app = createTestApp(db, { adminEmails: ['boss@example.org'] })
    const client = app.client()
    await signIn(app, client, 'boss@example.org')
    await createUser(db, { name: 'Pat', email: 'pat@example.org' })
    await createUser(db, { name: 'Pia', email: 'pia@example.org' })
    const profile = (await client.get(routes.account.profile.index.href())).text
    assert.match(profile, /2 demandes en attente\./)
  })

  it('gives every page a top bar with search, "+" to add equipment and the account', async () => {
    const app = createTestApp(db)
    const client = app.client()
    await signIn(app, client, 'camille@example.org')

    for (const url of [routes.home.href(), routes.collectifs.index.href()]) {
      const page = (await client.get(url)).text
      const top = /<header class="top-bar">(.*?)<\/header>/s.exec(page)?.[1] ?? ''
      assert.match(top, /<form method="get" action="\/inventaire"/, url)
      assert.match(top, /<label for="recherche-globale"[^>]*>Chercher dans mes collectifs<\/label>/)
      assert.match(top, /<input type="search" id="recherche-globale" name="q"/)
      // Icons only (ADR 0030): the names stay for screen readers and voice control.
      assert.match(
        top,
        /<button[^>]*class="secondary icon-button"[^>]*>.*?<span class="visually-hidden">Rechercher<\/span><\/button>/s,
      )
      assert.match(
        top,
        /<a href="\/materiel\/nouveau" title="Ajouter du matériel"[^>]*>.*?<span class="visually-hidden">Ajouter du matériel<\/span><\/a>/s,
      )
      assert.match(top, /aria-label="CM, mon compte : Camille Martin"/)
    }
    // The top bar's search lands on Rechercher with the words typed.
    const found = await client.get(`${routes.inventory.index.href()}?q=perceuse`)
    assert.equal(found.status, 200)
  })

  it('lists my collectifs in the sidebar, five at most, then "Tous"', async () => {
    const app = createTestApp(db)
    const client = app.client()
    await signIn(app, client, 'camille@example.org')
    assert.equal(myCollectifs((await client.get(routes.home.href())).text), null)

    for (const name of ['Ondes Courtes', "Collecti'FROG"]) {
      await createActiveCollectif(db, name, camille.id)
    }
    assert.deepEqual(myCollectifs((await client.get(routes.home.href())).text), [
      "Collecti'FROG /collectifs/collecti-frog",
      'Ondes Courtes /collectifs/ondes-courtes',
    ])

    for (const name of ['Atelier', 'Bal folk', 'Cirque', 'Danse']) {
      await createActiveCollectif(db, name, camille.id)
    }
    const shortcuts = myCollectifs((await client.get(routes.home.href())).text) ?? []
    assert.deepEqual(shortcuts, [
      'Atelier /collectifs/atelier',
      'Bal folk /collectifs/bal-folk',
      'Cirque /collectifs/cirque',
      "Collecti'FROG /collectifs/collecti-frog",
      'Danse /collectifs/danse',
      'Tous /collectifs',
    ])
  })

  it('gives no navigation to a pending account, only sign-out', async () => {
    await createUser(db, { name: 'Pat', email: 'pat@example.org' })
    const app = createTestApp(db)
    const client = app.client()
    await signIn(app, client, 'pat@example.org')

    const status = (await client.get(routes.account.status.href())).text
    assert.equal(mainNav(status), null)
    assert.doesNotMatch(status, /class="sidebar"|recherche-globale/)
    assert.match(status, /<form method="post" action="\/deconnexion"/)
  })

  it('gives no navigation to a visitor, only sign-in and sign-up', async () => {
    const app = createTestApp(db)
    const page = (await app.client().get(routes.signIn.form.index.href())).text

    assert.equal(mainNav(page), null)
    assert.doesNotMatch(page, /class="sidebar"|recherche-globale/)
    assert.match(page, /<a href="\/connexion">Se connecter<\/a>/)
    assert.match(page, /<a href="\/inscription">Créer un compte<\/a>/)
  })
})

describe('initialsOf', () => {
  it('takes the first letters of the first and last words', () => {
    assert.equal(initialsOf('Camille Martin'), 'CM')
    assert.equal(initialsOf('  jean  de la  fontaine '), 'JF')
    assert.equal(initialsOf('Émile'), 'É')
    assert.equal(initialsOf(''), '')
  })
})
