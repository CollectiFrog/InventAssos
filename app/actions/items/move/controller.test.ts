import * as assert from 'remix/assert'
import type { Database } from 'remix/data-table'
import { after, before, beforeEach, describe, it } from 'remix/test'

import { createTestApp, type TestApp } from '../../../../test/app.ts'
import { signIn } from '../../../../test/auth.ts'
import { createActiveCollectif } from '../../../../test/collectifs.ts'
import { openTestDatabase, resetDatabase } from '../../../../test/database.ts'
import { createTestItem } from '../../../../test/items.ts'
import { createTestLocation } from '../../../../test/locations.ts'
import { createActiveUser } from '../../../../test/users.ts'
import { listEntityHistory } from '../../../data/audit-log.ts'
import { findItemById } from '../../../data/items.ts'
import type { Item, Location } from '../../../data/tables.ts'
import { routes } from '../../../routes.ts'

describe('move an item (US-0.5.4)', () => {
  let db: Database
  let app: TestApp
  let local: Location
  let annex: Location
  let garage: Location
  let deposited: Item

  before(async () => {
    db = await openTestDatabase()
  })
  beforeEach(async () => {
    await resetDatabase(db)
    const rita = await createActiveUser(db, 'Rita', 'rita@example.org')
    const max = await createActiveUser(db, 'Max', 'max@example.org')
    await createActiveUser(db, 'Lou', 'lou@example.org')
    const grenouilles = await createActiveCollectif(db, 'Les Grenouilles', rita.id)
    local = await createTestLocation(db, { collectifId: grenouilles.id }, 'Local')
    annex = await createTestLocation(db, { collectifId: grenouilles.id }, 'Annexe')
    garage = await createTestLocation(db, { userId: max.id }, 'Garage')
    deposited = await createTestItem(db, {
      locationId: local.id,
      owner: { userId: max.id },
      createdBy: rita.id,
    })
    app = createTestApp(db)
  })
  after(async () => {
    await db.close()
  })

  async function move(email: string, target: Location) {
    const client = app.client()
    await signIn(app, client, email)
    return client.post(routes.items.move.action.href({ itemId: deposited.id }), {
      locationId: target.id,
    })
  }

  it("lets a responsible move it between the collectif's locations, and logs from/to", async () => {
    const response = await move('rita@example.org', annex)

    assert.equal(response.status, 303)
    assert.equal((await findItemById(db, deposited.id))?.location_id, annex.id)
    const entry = (await listEntityHistory(db, 'item', deposited.id)).at(-1)
    assert.equal(entry?.action, 'item.moved')
    assert.deepEqual(entry?.payload, { fromLocationId: local.id, toLocationId: annex.id })
  })

  it('lets the owner take their deposited item back to their own location', async () => {
    await move('max@example.org', garage)
    assert.equal((await findItemById(db, deposited.id))?.location_id, garage.id)
  })

  it('refuses a target location the actor does not manage (403)', async () => {
    const response = await move('rita@example.org', garage)
    assert.equal(response.status, 403)
    assert.equal((await findItemById(db, deposited.id))?.location_id, local.id)
  })

  it('refuses someone who may not edit the item (403)', async () => {
    const response = await move('lou@example.org', annex)
    assert.equal(response.status, 403)
  })

  it('offers only the locations the actor manages, without the current one', async () => {
    const client = app.client()
    await signIn(app, client, 'rita@example.org')
    const page = await client.get(routes.items.move.index.href({ itemId: deposited.id }))
    assert.match(page.text, /Annexe/)
    assert.doesNotMatch(page.text, /Garage/)
    assert.doesNotMatch(page.text, new RegExp(`value="${local.id}"`))
  })
})
