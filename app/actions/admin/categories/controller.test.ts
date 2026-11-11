import * as assert from 'remix/assert'
import { type Database, sql } from 'remix/data-table'
import { after, before, beforeEach, describe, it } from 'remix/test'

import { createTestApp, type TestClient } from '../../../../test/app.ts'
import { signIn } from '../../../../test/auth.ts'
import { openTestDatabase, resetDatabase } from '../../../../test/database.ts'
import { createTestItem } from '../../../../test/items.ts'
import { createTestLocation } from '../../../../test/locations.ts'
import { createActiveUser } from '../../../../test/users.ts'
import { listEntityHistory } from '../../../data/audit-log.ts'
import { findCategory, listCategories } from '../../../data/categories.ts'
import { archiveItem, findItemById } from '../../../data/items.ts'
import type { Item } from '../../../data/tables.ts'
import { routes } from '../../../routes.ts'

const urls = routes.admin.categories

describe('manage categories (US-0.7.10)', () => {
  let db: Database
  let admin: TestClient
  let rita: TestClient
  let drill: Item
  let oldDrill: Item

  before(async () => {
    db = await openTestDatabase()
  })
  beforeEach(async () => {
    await resetDatabase(db)
    const ritaUser = await createActiveUser(db, 'Rita', 'rita@example.org')
    const garage = await createTestLocation(db, { userId: ritaUser.id }, 'Garage')
    const add = (name: string) =>
      createTestItem(db, {
        locationId: garage.id,
        owner: { userId: ritaUser.id },
        createdBy: ritaUser.id,
        name,
      })
    drill = await add('Perceuse')
    oldDrill = await add('Vieille perceuse')
    await archiveItem(db, oldDrill.id, 'broken')
    await db.exec(sql`update items set category_id = 'power'`)
    const app = createTestApp(db, { adminEmails: ['boss@example.org'] })
    admin = app.client()
    await signIn(app, admin, 'boss@example.org')
    rita = app.client()
    await signIn(app, rita, 'rita@example.org')
  })
  after(async () => {
    await db.close()
  })

  const names = async () => (await listCategories(db)).map((c) => c.name)

  it('adds a category at the end, with a key from its name, shown at once in the forms', async () => {
    const response = await admin.post(urls.create.href(), { name: 'Instruments de musique' })
    assert.equal(response.location, urls.index.href())
    assert.equal((await names()).at(-1), 'Instruments de musique')
    assert.ok(await findCategory(db, 'instruments-de-musique'))
    assert.match(
      (await rita.get(routes.items.create.index.href())).text,
      /<option value="instruments-de-musique">Instruments de musique<\/option>/,
    )
    assert.match((await rita.get(routes.inventory.index.href())).text, /Instruments de musique/)
    const [entry] = await listEntityHistory(db, 'category', 'instruments-de-musique')
    assert.equal(entry?.action, 'category.created')
    assert.doesNotMatch(JSON.stringify(entry), /Instruments/)
  })

  it('refuses an empty name or one already used, ignoring case and accents', async () => {
    for (const name of ['', 'son', 'ELECTRICITE', ' Lumière ']) {
      const response = await admin.post(urls.create.href(), { name })
      assert.equal(response.status, 400, name)
    }
    assert.equal((await names()).length, 8)
    const response = await admin.post(urls.create.href(), { name: 'son' })
    assert.match(response.text, /Une catégorie porte déjà ce nom/)
  })

  it('renames a category and keeps its key, so items keep it', async () => {
    await admin.post(urls.rename.href({ categoryId: 'power' }), { name: 'Énergie' })
    assert.equal((await findCategory(db, 'power'))?.name, 'Énergie')
    assert.equal((await findItemById(db, drill.id))?.category_id, 'power')
    const refused = await admin.post(urls.rename.href({ categoryId: 'power' }), { name: 'Son' })
    assert.equal(refused.status, 400)
    assert.match(refused.text, /id="field-name-power-error"/)
  })

  it('moves a category up or down, and not past either end', async () => {
    await admin.post(urls.up.href({ categoryId: 'lighting' }))
    assert.deepEqual((await names()).slice(0, 2), ['Lumière', 'Son'])
    await admin.post(urls.down.href({ categoryId: 'lighting' }))
    assert.deepEqual((await names()).slice(0, 2), ['Son', 'Lumière'])
    await admin.post(urls.up.href({ categoryId: 'sound' }))
    assert.equal((await names())[0], 'Son')
    const moves = await listEntityHistory(db, 'category', 'sound')
    assert.equal(moves.length, 0, 'nothing moved, nothing logged')
  })

  it('deletes an unused category at once', async () => {
    await admin.post(urls.remove.href({ categoryId: 'video' }))
    assert.equal(await findCategory(db, 'video'), null)
  })

  it('moves the items of a used category to another one before deleting it', async () => {
    const refused = await admin.post(urls.remove.href({ categoryId: 'power' }))
    assert.equal(refused.status, 400)
    assert.match(refused.text, /Choisissez la catégorie qui reçoit son matériel/)
    assert.ok(await findCategory(db, 'power'))

    await admin.post(urls.remove.href({ categoryId: 'power' }), { moveTo: 'cabling' })
    assert.equal(await findCategory(db, 'power'), null)
    assert.equal((await findItemById(db, drill.id))?.category_id, 'cabling')
    assert.equal((await findItemById(db, oldDrill.id))?.category_id, 'cabling')
    const page = (await rita.get(routes.items.show.href({ itemId: drill.id }))).text
    assert.match(page, /Modifié \(catégorie\)/)
  })

  it('is for platform admins only', async () => {
    assert.equal((await rita.get(urls.index.href())).status, 403)
    assert.equal((await rita.post(urls.create.href(), { name: 'Pirate' })).status, 403)
    assert.equal((await names()).includes('Pirate'), false)
  })
})
