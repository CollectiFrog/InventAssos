import * as assert from 'remix/assert'
import type { Database } from 'remix/data-table'
import { after, before, beforeEach, describe, it } from 'remix/test'

import { createTestApp, type TestApp } from '../../../../test/app.ts'
import { signIn } from '../../../../test/auth.ts'
import { createActiveCollectif } from '../../../../test/collectifs.ts'
import { openTestDatabase, resetDatabase } from '../../../../test/database.ts'
import { itemFormFields } from '../../../../test/items.ts'
import { createTestLocation } from '../../../../test/locations.ts'
import { createActiveUser } from '../../../../test/users.ts'
import { findItemById } from '../../../data/items.ts'
import type { Location, User } from '../../../data/tables.ts'
import { createUser } from '../../../data/users.ts'
import { routes } from '../../../routes.ts'

describe("a person's item stored at a collectif (US-0.5.2)", () => {
  let db: Database
  let app: TestApp
  let max: User
  let local: Location
  let ritaHome: Location

  before(async () => {
    db = await openTestDatabase()
  })
  beforeEach(async () => {
    await resetDatabase(db)
    const rita = await createActiveUser(db, 'Rita', 'rita@example.org')
    max = await createActiveUser(db, 'Max', 'max@example.org')
    await createUser(db, { name: 'Pat', email: 'pat@example.org' })
    const collectif = await createActiveCollectif(db, 'Les Grenouilles', rita.id)
    local = await createTestLocation(db, { collectifId: collectif.id }, 'Local')
    ritaHome = await createTestLocation(db, { userId: rita.id }, 'Chez Rita')
    app = createTestApp(db)
  })
  after(async () => {
    await db.close()
  })

  async function deposit(email: string, fields: Record<string, string>) {
    const client = app.client()
    await signIn(app, client, email)
    const response = await client.post(routes.items.create.action.href(), itemFormFields(fields))
    return { client, response }
  }

  it("lets a responsible store a validated person's item in the collectif's location", async () => {
    const { response } = await deposit('rita@example.org', {
      locationId: local.id,
      owner: 'person',
      ownerEmail: 'MAX@example.org',
    })

    const id = /\/materiel\/([0-9a-f-]{36})$/.exec(response.location ?? '')?.[1] ?? ''
    const item = await findItemById(db, id)
    assert.equal(item?.owner_user_id, max.id)
    assert.equal(item?.owner_collectif_id, null)
    assert.equal(item?.location_id, local.id)

    // Max owns it and finds it; Mon matériel lists only what is stored at his places (US-0.7.3).
    const maxClient = app.client()
    await signIn(app, maxClient, 'max@example.org')
    assert.match((await maxClient.get(routes.inventory.index.href())).text, /Console Yamaha/)
    assert.doesNotMatch((await maxClient.get(routes.items.index.href())).text, /Console Yamaha/)
  })

  it('requires a validated account as owner', async () => {
    for (const email of ['pat@example.org', 'nobody@example.org']) {
      const { response } = await deposit('rita@example.org', {
        locationId: local.id,
        owner: 'person',
        ownerEmail: email,
      })
      assert.equal(response.status, 400, email)
      assert.match(response.text, /Aucun compte validé avec cette adresse/)
    }
  })

  it("is only possible in a collectif's location (403 in a personal one)", async () => {
    const { response } = await deposit('rita@example.org', {
      locationId: ritaHome.id,
      owner: 'person',
      ownerEmail: 'max@example.org',
    })
    assert.equal(response.status, 403)
  })
})
