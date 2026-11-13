import * as assert from 'remix/assert'
import { type Database, sql } from 'remix/data-table'
import { after, before, beforeEach, describe, it } from 'remix/test'

import { createTestApp, type TestApp, type TestClient } from '../../../test/app.ts'
import { signIn } from '../../../test/auth.ts'
import { createActiveCollectif } from '../../../test/collectifs.ts'
import { openTestDatabase, resetDatabase } from '../../../test/database.ts'
import { csvFile, importIdOf, uploadFile } from '../../../test/imports.ts'
import { createTestLocation } from '../../../test/locations.ts'
import { createActiveUser } from '../../../test/users.ts'
import { findTemplate } from '../../data/import-templates.ts'
import { findImport } from '../../data/imports.ts'
import type { Collectif, Location, User } from '../../data/tables.ts'
import { routes } from '../../routes.ts'

describe('import, step 3: categories, conditions and locations (US-0.10.1, ADR 0027)', () => {
  let db: Database
  let app: TestApp
  let rita: User
  let frog: Collectif
  let local: Location
  let cave: Location
  let client: TestClient

  before(async () => {
    db = await openTestDatabase()
  })
  beforeEach(async () => {
    await resetDatabase(db)
    rita = await createActiveUser(db, 'Rita', 'rita@example.org')
    frog = await createActiveCollectif(db, "Collecti'FROG", rita.id)
    local = await createTestLocation(db, { collectifId: frog.id }, 'Local')
    cave = await createTestLocation(db, { collectifId: frog.id }, 'Cave')
    app = createTestApp(db)
    client = app.client()
    await signIn(app, client, 'rita@example.org')
  })
  after(async () => {
    await db.close()
  })

  const file = () =>
    csvFile([
      ['Nom', 'Catégorie', 'État', 'Lieu', 'Truc'],
      ['Lyre', 'Projo', 'TBE', 'Cave', 'a'],
      ['Lyre 2', 'Projo', 'HS', 'Grenier', 'b'],
      ['Console', 'Machin', '', '', 'c'],
    ])

  async function startImport() {
    const response = await uploadFile(client, local.id, file())
    return importIdOf(response.location)
  }

  it('lists each distinct value with its rows and its guess, the unsure ones first', async () => {
    const importId = await startImport()
    const page = (await client.get(routes.imports.values.index.href({ importId }))).text
    assert.match(page, /Catégories · 2/)
    assert.ok(page.indexOf('Machin') < page.indexOf('Projo'), 'unsure values first')
    assert.match(page, /<td data-label="Lignes" class="num">2<\/td>/)
    assert.match(page, /name="category:projo"[^>]*>[\s\S]*?<option value="lighting" selected>/)
    assert.match(page, /name="category:machin"[\s\S]*?<option value="other" selected>/)
    assert.match(page, /name="condition:hs"[\s\S]*?<option value="broken" selected>/)
    assert.match(page, /name="location:cave"[\s\S]*?<option value="[0-9a-f-]+" selected>Cave/)
    assert.match(
      page,
      /name="location:grenier"[\s\S]*?<option value="" selected>Le lieu de l’import \(Local\)/,
    )
  })

  it('refuses a choice that is not offered, and saves the others with the template', async () => {
    const importId = await startImport()
    const url = routes.imports.values.action.href({ importId })
    const fields = {
      'category:projo': 'lighting',
      'category:machin': 'sound',
      'condition:tbe': 'good',
      'condition:hs': 'broken',
      'location:cave': cave.id,
      'location:grenier': '',
    }
    const bad = await client.post(url, { ...fields, 'category:machin': 'n-existe-pas' })
    assert.equal(bad.status, 400)
    assert.match(bad.text, /Choix inconnu/)
    assert.equal((await client.post(url, fields)).status, 303)
    const pending = await findImport(db, importId, rita.id)
    assert.equal(pending?.valueMapping.category.machin, 'sound')
    const template = await findTemplate(db, { collectifId: frog.id })
    assert.equal(template.valueMap.category.machin, 'sound')
  })

  it('starts the next file from what the collectif chose, columns and values', async () => {
    const first = await startImport()
    await client.post(routes.imports.columns.action.href({ importId: first }), {
      'col-0': 'name',
      'col-1': 'category',
      'col-2': 'condition',
      'col-3': 'location',
      'col-4': '',
    })
    await client.post(routes.imports.values.action.href({ importId: first }), {
      'category:projo': 'lighting',
      'category:machin': 'sound',
      'condition:tbe': 'good',
      'condition:hs': 'broken',
      'location:cave': cave.id,
      'location:grenier': '',
    })
    // Same file again: every column known (« Truc » left out on purpose), straight to the values.
    const response = await uploadFile(client, local.id, file())
    const second = importIdOf(response.location)
    assert.equal(response.location, routes.imports.values.index.href({ importId: second }))
    const pending = await findImport(db, second, rita.id)
    assert.deepEqual(pending?.columnMapping, ['name', 'category', 'condition', 'location', null])
    const page = (await client.get(response.location ?? '')).text
    assert.match(page, /name="category:machin"[\s\S]*?<option value="sound" selected>/)
  })

  it('sends a recognised file with too many values to the columns step, saying why', async () => {
    const rows = [
      ['Nom', 'Catégorie'],
      ...Array.from({ length: 150 }, (_, i) => [`O${i}`, `C${i}`]),
    ]
    const response = await uploadFile(client, local.id, csvFile(rows))
    const importId = importIdOf(response.location)
    assert.equal(response.location, routes.imports.columns.index.href({ importId }))
    const page = (await client.get(response.location ?? '')).text
    assert.match(page, /Plus de 100 valeurs différentes/)
    const values = await client.get(routes.imports.values.index.href({ importId }))
    assert.equal(values.location, routes.imports.columns.index.href({ importId }))
  })

  it('does not keep a choice whose category was deleted meanwhile', async () => {
    const importId = await startImport()
    await client.post(routes.imports.values.action.href({ importId }), {
      'category:projo': 'lighting',
      'category:machin': 'video',
      'condition:tbe': 'good',
      'condition:hs': 'broken',
      'location:cave': cave.id,
      'location:grenier': '',
    })
    await db.exec(sql`delete from categories where id = 'video'`)
    const page = (await client.get(routes.imports.values.index.href({ importId }))).text
    assert.match(page, /Machin<\/label><span class="status"> · à vérifier/)
    assert.match(page, /name="category:machin"[\s\S]*?<option value="other" selected>/)
  })

  it('refuses a value column with more than 100 different values', async () => {
    const rows = [
      ['Nom', 'Catégorie'],
      ...Array.from({ length: 101 }, (_, i) => [`O${i}`, `C${i}`]),
    ]
    const importId = importIdOf((await uploadFile(client, local.id, csvFile(rows))).location)
    const response = await client.post(routes.imports.columns.action.href({ importId }), {
      'col-0': 'name',
      'col-1': 'category',
    })
    assert.equal(response.status, 400)
    assert.match(response.text, /Plus de 100 valeurs différentes/)
  })
})
