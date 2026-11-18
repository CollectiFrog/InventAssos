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
    assert.doesNotMatch(home, /href="\/admin"/)

    // Computers reach it from the foot of the sidebar; CSS shows one or the other (ADR 0034).
    assert.match(
      home,
      /<a href="\/compte\/profil" title="Camille Martin" class="side-account"><span aria-hidden="true" class="initials">CM<\/span><span>Mon compte<\/span><\/a>/,
    )

    const profile = (await client.get(routes.account.profile.index.href())).text
    assert.match(profile, /<a href="\/compte\/profil" aria-label="[^"]*" aria-current="page"/)
    assert.match(profile, /<a href="\/compte\/profil"[^>]*aria-current="page" class="side-account"/)
    assert.deepEqual(currentEntries(profile), [])
    assert.match(profile, /Se déconnecter/)
  })

  it('adds Administration to the navigation for staff only, and leaves Mon compte (ADR 0033)', async () => {
    const app = createTestApp(db, { adminEmails: ['boss@example.org'] })
    const boss = app.client()
    await signIn(app, boss, 'boss@example.org')

    const nav = mainNav((await boss.get(routes.home.href())).text) ?? ''
    const labels = [...nav.matchAll(/<span>(.*?)<\/span>/g)].map((match) => match[1])
    assert.deepEqual(labels, [
      'Accueil',
      'Rechercher',
      'Mon matériel',
      'Collectifs',
      // A soft hyphen breaks it where the column is too narrow.
      'Adminis\u00adtration',
    ])
    assert.match(nav, /<a href="\/admin">/)
    const profile = (await boss.get(routes.account.profile.index.href())).text
    assert.doesNotMatch(profile, /id="administration"|Ouvrir l’administration/)
    // Every admin page marks the entry as current, with no breadcrumb back to Mon compte.
    for (const url of [
      routes.admin.index.href(),
      routes.admin.accounts.href(),
      routes.admin.collectifs.index.href(),
      routes.admin.team.index.href(),
      routes.admin.categories.index.href(),
    ]) {
      const page = (await boss.get(url)).text
      assert.deepEqual(currentEntries(page), ['Adminis\u00adtration'], url)
      assert.doesNotMatch(page, /class="back-link"|Fil d’Ariane/, url)
    }

    const member = app.client()
    await signIn(app, member, 'camille@example.org')
    assert.doesNotMatch(
      mainNav((await member.get(routes.home.href())).text) ?? '',
      /href="\/admin"/,
    )
  })

  it('keeps only the brand and the account in the top bar, shown on phones (US-0.10.20)', async () => {
    const app = createTestApp(db)
    const client = app.client()
    await signIn(app, client, 'camille@example.org')

    for (const url of [routes.home.href(), routes.collectifs.index.href()]) {
      const page = (await client.get(url)).text
      const top = /<header class="top-bar">(.*?)<\/header>/s.exec(page)?.[1] ?? ''
      assert.match(top, /aria-label="CM, mon compte : Camille Martin"/, url)
      // Search is in the navigation, adding is in the pages (ADR 0037).
      assert.doesNotMatch(top, /type="search"|\/materiel\/nouveau/, url)
    }
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
    assert.doesNotMatch(status, /class="sidebar"|class="avatar"/)
    assert.match(status, /<form method="post" action="\/deconnexion"/)
  })

  it('gives a visitor no navigation and no header links: the pages link each other', async () => {
    const app = createTestApp(db)
    const client = app.client()
    const signInPage = (await client.get(routes.signIn.form.index.href())).text
    const signUpPage = (await client.get(routes.signUp.form.index.href())).text
    const home = (await client.get(routes.home.href())).text

    for (const page of [signInPage, signUpPage, home]) {
      assert.equal(mainNav(page), null)
      assert.doesNotMatch(page, /class="sidebar"|class="avatar"/)
      assert.match(page, /<div class="header-links"><\/div>/)
    }
    assert.match(signInPage, /Pas encore de compte \? <a href="\/inscription">Créer un compte<\/a>/)
    assert.match(signUpPage, /Déjà un compte \? <a href="\/connexion">Se connecter<\/a>/)
    assert.match(home, /<a href="\/connexion" class="button">Se connecter/)
    assert.match(home, /<a href="\/inscription" class="button secondary">Créer un compte/)
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
