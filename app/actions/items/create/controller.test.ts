import * as assert from 'remix/assert'
import { type Database, sql } from 'remix/data-table'
import { after, before, beforeEach, describe, it } from 'remix/test'

import { createTestApp, type TestApp } from '../../../../test/app.ts'
import { signIn } from '../../../../test/auth.ts'
import { createActiveCollectif } from '../../../../test/collectifs.ts'
import { openTestDatabase, resetDatabase } from '../../../../test/database.ts'
import { createTestItem, itemFormFields } from '../../../../test/items.ts'
import { createTestLocation } from '../../../../test/locations.ts'
import { createActiveUser } from '../../../../test/users.ts'
import { listEntityHistory } from '../../../data/audit-log.ts'
import { findItemById } from '../../../data/items.ts'
import { findLocationById } from '../../../data/locations.ts'
import type { Collectif, Location, User } from '../../../data/tables.ts'
import { routes } from '../../../routes.ts'

describe('add an item (US-0.5.1)', () => {
  let db: Database
  let app: TestApp
  let rita: User
  let max: User
  let collectif: Collectif
  let local: Location
  let garage: Location

  before(async () => {
    db = await openTestDatabase()
  })
  beforeEach(async () => {
    await resetDatabase(db)
    rita = await createActiveUser(db, 'Rita', 'rita@example.org')
    max = await createActiveUser(db, 'Max', 'max@example.org')
    collectif = await createActiveCollectif(db, 'Les Grenouilles', rita.id)
    local = await createTestLocation(db, { collectifId: collectif.id }, 'Local')
    garage = await createTestLocation(db, { userId: max.id }, 'Garage')
    app = createTestApp(db, { adminEmails: ['boss@example.org'] })
  })
  after(async () => {
    await db.close()
  })

  async function clientFor(email: string) {
    const client = app.client()
    await signIn(app, client, email)
    return client
  }

  async function add(email: string, fields: Record<string, string>) {
    const client = await clientFor(email)
    const response = await client.post(routes.items.create.action.href(), itemFormFields(fields))
    return { client, response }
  }

  function itemIdFrom(location: string | null) {
    return /\/materiel\/([0-9a-f-]{36})$/.exec(location ?? '')?.[1] ?? ''
  }

  it('lets a validated user add an item to their own location, owned by them', async () => {
    const { client, response } = await add('max@example.org', {
      locationId: garage.id,
      owner: 'me',
    })

    assert.equal(response.status, 303)
    const item = await findItemById(db, itemIdFrom(response.location))
    assert.equal(item?.owner_user_id, max.id)
    assert.equal(item?.location_id, garage.id)
    assert.equal(item?.quantity, 2)
    assert.equal(Number(item?.estimated_value), 150.5)
    const page = await client.get(response.location ?? '')
    assert.match(page.text, /Console Yamaha × 2/)
    assert.match(page.text, /150,50/)
    assert.match((await client.get(routes.items.index.href())).text, /Console Yamaha/)
    const [entry] = await listEntityHistory(db, 'item', item?.id ?? '')
    assert.equal(entry?.action, 'item.created')
  })

  it('lets a responsible add an item owned by the collectif to its location', async () => {
    const { response } = await add('rita@example.org', {
      locationId: local.id,
      owner: `collectif:${collectif.id}`,
    })
    const item = await findItemById(db, itemIdFrom(response.location))
    assert.equal(item?.owner_collectif_id, collectif.id)
  })

  it('refuses a location the actor does not manage (403)', async () => {
    const { response } = await add('max@example.org', { locationId: local.id, owner: 'me' })
    assert.equal(response.status, 403)
    const rows = await db.exec(sql`select count(*)::int as n from items`)
    assert.equal(rows.rows?.[0]?.n, 0)
  })

  it('refuses an owner the actor may not choose (403)', async () => {
    const { response } = await add('max@example.org', {
      locationId: garage.id,
      owner: `collectif:${collectif.id}`,
    })
    assert.equal(response.status, 403)
  })

  it('validates quantity, value and category in French', async () => {
    const { response } = await add('max@example.org', {
      locationId: garage.id,
      owner: 'me',
      quantity: '0',
      estimatedValue: 'beaucoup',
      categoryId: 'spaceships',
    })
    assert.equal(response.status, 400)
    assert.match(response.text, /Au moins 1/)
    assert.match(response.text, /Montant invalide/)
  })

  it('refuses, in the database, an item with two owners, none, or a quantity of 0', async () => {
    const base = sql`insert into items (name, category_id, location_id`
    await assert.rejects(db.exec(sql`${base}) values ('x', 'other', ${garage.id})`))
    await assert.rejects(
      db.exec(sql`${base}, owner_user_id, owner_collectif_id)
        values ('x', 'other', ${garage.id}, ${max.id}, ${collectif.id})`),
    )
    await assert.rejects(
      db.exec(
        sql`${base}, owner_user_id, quantity) values ('x', 'other', ${garage.id}, ${max.id}, 0)`,
      ),
    )
  })

  it('refuses to delete a location that still holds an item (US-0.4.1)', async () => {
    await createTestItem(db, {
      locationId: garage.id,
      owner: { userId: max.id },
      createdBy: max.id,
    })
    const client = await clientFor('max@example.org')

    await client.post(routes.locations.remove.href({ locationId: garage.id }))
    assert.ok(await findLocationById(db, garage.id))
    assert.match((await client.get(routes.locations.index.href())).text, /contient du matériel/)
  })
})
