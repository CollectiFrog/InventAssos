import * as assert from 'remix/assert'
import type { Database } from 'remix/data-table'
import { after, before, beforeEach, describe, it } from 'remix/test'

import { createTestApp, type TestApp } from '../../../test/app.ts'
import { signIn } from '../../../test/auth.ts'
import { createActiveCollectif } from '../../../test/collectifs.ts'
import { openTestDatabase, resetDatabase } from '../../../test/database.ts'
import { createTestLocation } from '../../../test/locations.ts'
import { createActiveUser } from '../../../test/users.ts'
import type { Collectif } from '../../data/tables.ts'
import { routes } from '../../routes.ts'

/** Labels of the collectif's tabs, the current one marked with a star. */
function tabs(html: string): string[] {
  const nav = /<nav aria-label="[^"]*" class="tabs">(.*?)<\/nav>/s.exec(html)?.[1] ?? ''
  return [...nav.matchAll(/<a href="([^"]+)"( aria-current="page")?>(.*?)<\/a>/g)].map(
    ([, href, current, label]) => `${current ? '*' : ''}${label} ${href}`,
  )
}

describe('collectif page in tabs (US-0.7.5)', () => {
  let db: Database
  let app: TestApp
  let frog: Collectif

  before(async () => {
    db = await openTestDatabase()
  })
  beforeEach(async () => {
    await resetDatabase(db)
    const rita = await createActiveUser(db, 'Rita', 'rita@example.org')
    await createActiveUser(db, 'Lou', 'lou@example.org')
    frog = await createActiveCollectif(db, "Collecti'FROG", rita.id)
    await createTestLocation(db, { collectifId: frog.id }, 'Local du FROG')
    app = createTestApp(db)
  })
  after(async () => {
    await db.close()
  })

  async function page(email: string, url: string): Promise<string> {
    const client = app.client()
    await signIn(app, client, email)
    return (await client.get(url)).text
  }

  it('gives its people three tabs at their own URLs, the current one marked', async () => {
    const slug = frog.slug
    const urls = {
      items: routes.collectifs.show.href({ slug }),
      places: routes.collectifs.places.href({ slug }),
      people: routes.collectifs.people.href({ slug }),
    }
    const all = [`Matériel ${urls.items}`, `Lieux ${urls.places}`, `Membres ${urls.people}`]
    const mark = (n: number) => all.map((tab, i) => (i === n ? `*${tab}` : tab))
    assert.deepEqual(tabs(await page('rita@example.org', urls.items)), mark(0))
    const places = await page('rita@example.org', urls.places)
    assert.deepEqual(tabs(places), mark(1))
    assert.match(places, /Local du FROG/)
    const people = await page('rita@example.org', urls.people)
    assert.deepEqual(tabs(people), mark(2))
    assert.match(people, />Rita<\/a>/)
  })

  it('gives its responsibles « + Matériel » in the Matériel tab, with the collectif as owner', async () => {
    const html = await page('rita@example.org', routes.collectifs.show.href({ slug: frog.slug }))
    const add = `${routes.items.create.index.href()}?pour=collectif:${frog.id}`
    assert.ok(html.indexOf(`href="${add}"`) > html.indexOf('class="tabs"'))
    assert.match(
      html,
      new RegExp(
        `href="${add.replace('?', '\\?')}" title="Ajouter du matériel à [^"]+"[^>]*with-text`,
      ),
    )

    const form = await page('rita@example.org', add)
    assert.match(form, new RegExp(`<option value="collectif:${frog.id}" selected>`))
  })

  it('ignores an owner in the link that the user may not choose', async () => {
    const form = await page(
      'lou@example.org',
      `${routes.items.create.index.href()}?pour=collectif:${frog.id}`,
    )
    assert.match(form, /<option value="me" selected>/)
    assert.doesNotMatch(form, new RegExp(`collectif:${frog.id}`))
  })

  it('lets the selected tab name the list: a count instead of a repeated title (US-0.10.23)', async () => {
    const slug = frog.slug
    const items = await page('rita@example.org', routes.collectifs.show.href({ slug }))
    assert.match(
      items,
      /<h2 id="materiel-collectif" class="visually-hidden">Matériel du collectif<\/h2><p class="status">0 objet<\/p>/,
    )
    const places = await page('rita@example.org', routes.collectifs.places.href({ slug }))
    assert.match(
      places,
      /<h2 id="lieux-collectif" class="visually-hidden">Lieux de stockage<\/h2><p class="status">1 lieu<\/p>/,
    )
    const people = await page('rita@example.org', routes.collectifs.people.href({ slug }))
    assert.match(
      people,
      /<h2 id="membres" class="visually-hidden">Membres<\/h2><p class="status">1 membre<\/p>/,
    )
  })

  it('puts an outsider’s two requests side by side, without explanation (US-0.10.23)', async () => {
    const html = await page('lou@example.org', routes.collectifs.show.href({ slug: frog.slug }))
    assert.match(
      html,
      /<div class="actions join-panel"><form[^>]*>.*?Demander à rejoindre<\/button><\/form><form[^>]*><input[^>]*\/><button type="submit" class="secondary">Demander à devenir responsable<\/button><\/form><\/div>/s,
    )
    assert.doesNotMatch(html, /plus de responsable joignable/)
  })

  it('asks the platform for a replacement responsible without a paragraph of explanation', async () => {
    const admin = createTestApp(db, { adminEmails: ['lou@example.org'] })
    const client = admin.client()
    await signIn(admin, client, 'lou@example.org')
    const html = (await client.get(routes.collectifs.people.href({ slug: frog.slug }))).text
    assert.match(
      html,
      /<h2 id="gerer-responsables">Remplacer un responsable<\/h2><ul class="cards">/,
    )
    assert.doesNotMatch(html, /Pour la plateforme/)
  })

  it('shows an outsider the same directory entry on every tab URL', async () => {
    for (const route of [routes.collectifs.places, routes.collectifs.people]) {
      const html = await page('lou@example.org', route.href({ slug: frog.slug }))
      assert.deepEqual(tabs(html), [])
      assert.doesNotMatch(html, /Local du FROG|Rita/)
      assert.match(html, /Demander à devenir responsable/)
    }
  })
})
