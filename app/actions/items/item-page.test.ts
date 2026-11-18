// Field feedback round 5 on the item form and page (US-0.10.18, US-0.10.19, US-0.10.22).
import * as assert from 'remix/assert'
import { type Database, sql } from 'remix/data-table'
import { after, before, beforeEach, describe, it } from 'remix/test'

import { createTestApp, type TestClient } from '../../../test/app.ts'
import { signIn } from '../../../test/auth.ts'
import { openTestDatabase, resetDatabase } from '../../../test/database.ts'
import { itemFormFields } from '../../../test/items.ts'
import { createTestLocation } from '../../../test/locations.ts'
import { createActiveUser } from '../../../test/users.ts'
import { routes } from '../../routes.ts'

describe('item form and page after field feedback', () => {
  let db: Database
  let client: TestClient
  let garageId: string

  before(async () => {
    db = await openTestDatabase()
  })
  beforeEach(async () => {
    await resetDatabase(db)
    const max = await createActiveUser(db, 'Max', 'max@example.org')
    garageId = (await createTestLocation(db, { userId: max.id }, 'Garage')).id
    const app = createTestApp(db)
    client = app.client()
    await signIn(app, client, 'max@example.org')
  })
  after(async () => {
    await db.close()
  })

  /** Adds an item through the form and returns its page. */
  async function addItem(fields: Record<string, string>): Promise<string> {
    const created = await client.post(
      routes.items.create.action.href(),
      itemFormFields({ locationId: garageId, owner: 'me', ...fields }),
    )
    return (await client.get(created.location ?? '')).text
  }

  it('keeps the browser from filling the item name with the person’s own', async () => {
    const form = (await client.get(routes.items.create.index.href())).text
    assert.match(form, /<label for="field-name">Nom du matériel<\/label>/)
    assert.match(form, /<input id="field-name" name="name"[^>]*autocomplete="off"/)
  })

  it('asks for the value new, stored under its own name', async () => {
    const form = (await client.get(routes.items.create.index.href())).text
    assert.match(form, /<label for="field-replacementValue">Valeur à neuf \(€\)/)

    const page = await addItem({ replacementValue: '492' })
    assert.match(page, /<dt>Valeur à neuf<\/dt><dd>492,00/)
    const result = await db.exec(sql`select replacement_value from items`)
    assert.equal(Number(result.rows?.[0]?.replacement_value), 492)
  })

  it('shows a pasted web address as a short link to its site', async () => {
    const url = 'https://fr.shop.example/products/lyre-300w?variant=4656&gclid=abc'
    const page = await addItem({ description: `Achetée ici : ${url}.` })
    assert.match(
      page,
      /Achetée ici : <a href="https:\/\/fr\.shop\.example\/products\/lyre-300w\?variant=4656&amp;gclid=abc" title="[^"]+" rel="nofollow noopener noreferrer" class="url-link">fr\.shop\.example ↗<\/a>\./,
    )
  })

  it('leaves text that only looks like an address as text', async () => {
    const page = await addItem({ description: 'javascript:alert(1) et www.exemple.org' })
    assert.doesNotMatch(page, /class="url-link"/)
    assert.match(page, /javascript:alert\(1\) et www\.exemple\.org/)
  })

  it('folds the history under « Avancé »', async () => {
    const page = await addItem({})
    assert.match(
      page,
      /<details class="more"><summary>Avancé<svg[^>]*>.*?<\/svg><\/summary><section><h2>Historique<\/h2>/s,
    )
  })

  it('says where it is in the header for phones, hidden beside the side panel', async () => {
    const page = await addItem({})
    assert.match(page, /<span class="item-where">À <a href="\/personnes\/[^"]+">Max<\/a> · rangé à/)
  })
})
