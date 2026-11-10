import * as assert from 'remix/assert'
import type { Database } from 'remix/data-table'
import { after, before, beforeEach, describe, it } from 'remix/test'

import { createTestApp } from '../../test/app.ts'
import { signIn } from '../../test/auth.ts'
import { openTestDatabase, resetDatabase } from '../../test/database.ts'
import { createActiveUser } from '../../test/users.ts'
import { createUser } from '../data/users.ts'
import { routes } from '../routes.ts'
import { initialsOf } from './layout.tsx'

/** The main navigation of a page, or null when it has none. */
function mainNav(html: string): string | null {
  return /<nav aria-label="Navigation principale"[^>]*>(.*?)<\/nav>/s.exec(html)?.[1] ?? null
}

/** Labels of the entries marked as current in the main navigation. */
function currentEntries(html: string): string[] {
  const nav = mainNav(html) ?? ''
  return [...nav.matchAll(/<a [^>]*aria-current="page"[^>]*>.*?<span>(.*?)<\/span><\/a>/gs)].map(
    (match) => match[1] ?? '',
  )
}

describe('navigation (US-0.7.1)', () => {
  let db: Database

  before(async () => {
    db = await openTestDatabase()
  })
  beforeEach(async () => {
    await resetDatabase(db)
    await createActiveUser(db, 'Camille Martin', 'camille@example.org')
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

  it('keeps "Mes lieux" one tap away from Mon matériel, which replaced it in the bar', async () => {
    const app = createTestApp(db)
    const client = app.client()
    await signIn(app, client, 'camille@example.org')

    // Without a location yet, the page explains why; with one, it links next to "Ajouter".
    assert.match(
      (await client.get(routes.items.index.href())).text,
      /<a href="\/lieux"[^>]*>Mes lieux<\/a>/,
    )
    await client.post(routes.locations.create.action.href(), {
      owner: 'me',
      name: 'Garage',
      city: 'Rennes',
    })
    const mine = (await client.get(routes.items.index.href())).text
    assert.match(mine, /Ajouter du matériel/)
    assert.match(mine, /<a [^>]*href="\/lieux"[^>]*>Mes lieux<\/a>/)
  })

  it('puts the account in the header with initials, and marks it on the profile page', async () => {
    const app = createTestApp(db)
    const client = app.client()
    await signIn(app, client, 'camille@example.org')

    const home = (await client.get(routes.home.href())).text
    assert.match(
      home,
      /<a href="\/compte\/profil" aria-label="Mon compte : Camille Martin"[^>]*>CM<\/a>/,
    )
    assert.doesNotMatch(home, /Administration/)

    const profile = (await client.get(routes.account.profile.index.href())).text
    assert.match(profile, /<a href="\/compte\/profil" aria-label="[^"]*" aria-current="page"/)
    assert.deepEqual(currentEntries(profile), [])
    assert.match(profile, /Se déconnecter/)
  })

  it('shows Administration in the header to a platform admin only, current on /admin', async () => {
    const app = createTestApp(db, { adminEmails: ['boss@example.org'] })
    const client = app.client()
    await signIn(app, client, 'boss@example.org')

    assert.match(
      (await client.get(routes.home.href())).text,
      /<a href="\/admin">Administration<\/a>/,
    )
    const queue = (await client.get(routes.admin.index.href())).text
    assert.match(queue, /<a href="\/admin" aria-current="page">Administration<\/a>/)
  })

  it('gives no navigation to a pending account, only sign-out', async () => {
    await createUser(db, { name: 'Pat', email: 'pat@example.org' })
    const app = createTestApp(db)
    const client = app.client()
    await signIn(app, client, 'pat@example.org')

    const status = (await client.get(routes.account.status.href())).text
    assert.equal(mainNav(status), null)
    assert.match(status, /<form method="post" action="\/deconnexion"/)
  })

  it('gives no navigation to a visitor, only sign-in and sign-up', async () => {
    const app = createTestApp(db)
    const page = (await app.client().get(routes.signIn.form.index.href())).text

    assert.equal(mainNav(page), null)
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
