import * as assert from 'remix/assert'
import { type Database, sql } from 'remix/data-table'
import { after, before, beforeEach, describe, it } from 'remix/test'

import { createTestApp, type TestClient } from '../../../test/app.ts'
import { signIn } from '../../../test/auth.ts'
import { createActiveCollectif } from '../../../test/collectifs.ts'
import { openTestDatabase, resetDatabase } from '../../../test/database.ts'
import { createTestItem } from '../../../test/items.ts'
import { createTestLocation } from '../../../test/locations.ts'
import { createActiveUser } from '../../../test/users.ts'
import type { Collectif } from '../../data/tables.ts'
import { routes } from '../../routes.ts'

/** Item names in the results table, in order. */
function rows(html: string): string[] {
  return [
    ...html.matchAll(/<td data-label="Nom" class="cell-name"><a [^>]*><strong>(.*?)<\/strong>/g),
  ].map((m) => m[1] ?? '')
}

describe('Rechercher and a collectif’s equipment as dense tables (US-0.7.13)', () => {
  let db: Database
  let rita: TestClient
  let frog: Collectif

  before(async () => {
    db = await openTestDatabase()
  })
  beforeEach(async () => {
    await resetDatabase(db)
    const ritaUser = await createActiveUser(db, 'Rita', 'rita@example.org')
    frog = await createActiveCollectif(db, "Collecti'FROG", ritaUser.id)
    const rennes = await createTestLocation(db, { collectifId: frog.id }, 'Local')
    const vitre = await createTestLocation(db, { collectifId: frog.id }, 'Annexe')
    await db.exec(sql`update locations set city = 'Vitré' where id = ${vitre.id}`)
    const add = async (name: string, locationId: string, quantity: number, category: string) => {
      const item = await createTestItem(db, {
        locationId,
        owner: { collectifId: frog.id },
        createdBy: ritaUser.id,
        name,
      })
      await db.exec(sql`update items set quantity = ${quantity}, category_id = ${category}
        where id = ${item.id}`)
    }
    await add('Barnum', vitre.id, 2, 'structure')
    await add('Console', rennes.id, 1, 'sound')
    await add('Projecteur', rennes.id, 8, 'lighting')
    const app = createTestApp(db)
    rita = app.client()
    await signIn(app, rita, 'rita@example.org')
  })
  after(async () => {
    await db.close()
  })

  const search = async (query = '') =>
    (await rita.get(`${routes.inventory.index.href()}${query}`)).text

  it('sorts by a column from its header, then back the other way', async () => {
    const byName = await search()
    assert.deepEqual(rows(byName), ['Barnum', 'Console', 'Projecteur'])
    assert.match(
      byName,
      /<th scope="col" aria-sort="ascending"><a href="\/inventaire\?tri=-nom">Nom/,
    )
    assert.match(byName, /<a href="\/inventaire\?tri=quantite">Qté/)

    assert.deepEqual(rows(await search('?tri=quantite')), ['Console', 'Barnum', 'Projecteur'])
    assert.deepEqual(rows(await search('?tri=-quantite')), ['Projecteur', 'Barnum', 'Console'])
    assert.deepEqual(rows(await search('?tri=ville')), ['Console', 'Projecteur', 'Barnum'])
  })

  it('ignores a sort it does not know, whatever the URL holds', async () => {
    const html = await search(`?tri=${encodeURIComponent('name; drop table items')}`)
    assert.deepEqual(rows(html), ['Barnum', 'Console', 'Projecteur'])
  })

  it('lists the active filters, each removable, keeping the others and the sort', async () => {
    const html = await search('?q=o&categorie=sound&tri=-nom&page=1')
    assert.match(
      html,
      /<a href="\/inventaire\?categorie=sound&amp;tri=-nom"[^>]*class="chip">« o »/,
    )
    assert.match(html, /<a href="\/inventaire\?q=o&amp;tri=-nom"[^>]*class="chip">Catégorie : Son/)
    assert.match(html, /<a href="\/inventaire\?tri=-nom">Tout effacer<\/a>/)
    assert.match(html, /<input type="hidden" name="tri" value="-nom"/)
  })

  it('shows how many visible items each category and city holds', async () => {
    const html = await search()
    assert.match(html, /<option value="lighting"[^>]*>Lumière \(1\)<\/option>/)
    assert.match(html, /<option value="Vitré"[^>]*>Vitré \(1\)<\/option>/)
    assert.match(html, /<option value="Rennes"[^>]*>Rennes \(2\)<\/option>/)
  })

  it('switches to cards with ?vue=grille and keeps it when filtering', async () => {
    const html = await search('?vue=grille')
    assert.match(html, /<ul class="cards item-grid">/)
    assert.match(html, /<input type="hidden" name="vue" value="grille"/)
    assert.match(html, /<a href="\/inventaire\?vue=grille" aria-current="page">Grille<\/a>/)
  })

  it("sorts a collectif's equipment the same way", async () => {
    const url = routes.collectifs.show.href({ slug: frog.slug })
    const html = (await rita.get(`${url}?tri=-quantite`)).text
    assert.deepEqual(rows(html), ['Projecteur', 'Barnum', 'Console'])
    const grid = (await rita.get(`${url}?vue=grille`)).text
    assert.match(grid, /<ul class="cards item-grid">/)
  })
})
