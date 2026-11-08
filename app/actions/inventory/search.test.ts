import * as assert from 'remix/assert'
import { type Database, sql } from 'remix/data-table'
import { after, before, beforeEach, describe, it } from 'remix/test'

import { createTestApp, type TestApp, type TestClient } from '../../../test/app.ts'
import { signIn } from '../../../test/auth.ts'
import { createActiveCollectif } from '../../../test/collectifs.ts'
import { openTestDatabase, resetDatabase } from '../../../test/database.ts'
import { createTestItem } from '../../../test/items.ts'
import { createActiveUser } from '../../../test/users.ts'
import { createLocation } from '../../data/locations.ts'
import type { Collectif } from '../../data/tables.ts'
import { routes } from '../../routes.ts'

describe('search and filter the inventory (US-0.6.2)', () => {
  let db: Database
  let app: TestApp
  let lou: TestClient
  let grenouilles: Collectif

  before(async () => {
    db = await openTestDatabase()
  })
  beforeEach(async () => {
    await resetDatabase(db)
    const rita = await createActiveUser(db, 'Rita', 'rita@example.org')
    const max = await createActiveUser(db, 'Max', 'max@example.org')
    await createActiveUser(db, 'Lou', 'lou@example.org')
    grenouilles = await createActiveCollectif(db, 'Les Grenouilles', rita.id)
    const local = await createLocation(
      db,
      { collectifId: grenouilles.id },
      {
        name: 'Local',
        city: 'Rennes',
        address: null,
        notes: null,
      },
    )
    const garage = await createLocation(
      db,
      { userId: max.id },
      {
        name: 'Garage',
        city: 'Saint-Malo',
        address: null,
        notes: null,
      },
    )
    const add = (
      name: string,
      locationId: string,
      owner: { collectifId: string } | { userId: string },
    ) => createTestItem(db, { locationId, owner, createdBy: rita.id, name })
    await add('Console numérique', local.id, { collectifId: grenouilles.id })
    await add('Projecteur à LED', local.id, { collectifId: grenouilles.id })
    await add('Enceinte active', garage.id, { userId: max.id })
    await db.exec(
      sql`update items set brand = 'Yamaha', category_id = 'sound' where name = 'Console numérique'`,
    )
    await db.exec(
      sql`update items set description = 'Très lumineux, 100% LED' where name = 'Projecteur à LED'`,
    )
    await db.exec(sql`update items set category_id = 'sound' where name = 'Enceinte active'`)
    app = createTestApp(db)
    lou = app.client()
    await signIn(app, lou, 'lou@example.org')
  })
  after(async () => {
    await db.close()
  })

  async function names(query: Record<string, string>) {
    const url = `${routes.inventory.index.href()}?${new URLSearchParams(query)}`
    const html = (await lou.get(url)).text
    return [...html.matchAll(/<strong>([^<]+)<\/strong><\/a>/g)].map((m) => m[1]).sort()
  }

  it('searches name, brand, model and description, ignoring case and accents', async () => {
    assert.deepEqual(await names({ q: 'NUMERIQUE' }), ['Console numérique'])
    assert.deepEqual(await names({ q: 'yamaha' }), ['Console numérique'])
    assert.deepEqual(await names({ q: 'tres lumineux' }), ['Projecteur à LED'])
    assert.deepEqual(await names({ q: '100%' }), ['Projecteur à LED'])
    assert.deepEqual(await names({ q: 'nothing like this' }), [])
  })

  it('filters by category, owning collectif and city, and combines them', async () => {
    assert.deepEqual(await names({ categorie: 'sound' }), ['Console numérique', 'Enceinte active'])
    assert.deepEqual(await names({ collectif: grenouilles.id }), [
      'Console numérique',
      'Projecteur à LED',
    ])
    assert.deepEqual(await names({ ville: 'saint-malo' }), ['Enceinte active'])
    assert.deepEqual(await names({ categorie: 'sound', ville: 'Rennes' }), ['Console numérique'])
    assert.deepEqual(
      await names({ categorie: 'sound', q: 'enceinte', collectif: grenouilles.id }),
      [],
    )
  })

  it('keeps the search and filters in the form', async () => {
    const html = (await lou.get(`${routes.inventory.index.href()}?q=console&categorie=sound`)).text
    assert.match(html, /name="q"[^>]*value="console"/)
    assert.match(html, /<option value="sound" selected/)
  })

  it('ignores a malformed collectif filter instead of failing', async () => {
    const response = await lou.get(`${routes.inventory.index.href()}?collectif=not-a-uuid`)
    assert.equal(response.status, 200)
  })
})
