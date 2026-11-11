import * as assert from 'remix/assert'
import { type Database, sql } from 'remix/data-table'
import { after, before, beforeEach, describe, it } from 'remix/test'

import { createTestApp, type TestApp, type TestClient } from '../../../../test/app.ts'
import { signIn } from '../../../../test/auth.ts'
import { createActiveCollectif } from '../../../../test/collectifs.ts'
import { openTestDatabase, resetDatabase } from '../../../../test/database.ts'
import { itemFormFields } from '../../../../test/items.ts'
import { createActiveUser } from '../../../../test/users.ts'
import { findItemById } from '../../../data/items.ts'
import { findLocationById } from '../../../data/locations.ts'
import type { Collectif, User } from '../../../data/tables.ts'
import { routes } from '../../../routes.ts'

describe('create a location while adding (US-0.7.4)', () => {
  let db: Database
  let app: TestApp
  let lou: User
  let louClient: TestClient
  let frog: Collectif

  before(async () => {
    db = await openTestDatabase()
  })
  beforeEach(async () => {
    await resetDatabase(db)
    const rita = await createActiveUser(db, 'Rita', 'rita@example.org')
    lou = await createActiveUser(db, 'Lou', 'lou@example.org')
    frog = await createActiveCollectif(db, "Collecti'FROG", rita.id)
    app = createTestApp(db)
    louClient = app.client()
    await signIn(app, louClient, 'lou@example.org')
  })
  after(async () => {
    await db.close()
  })

  it('starts on « Un nouveau lieu », open, for someone without any location', async () => {
    const html = (await louClient.get(routes.items.create.index.href())).text
    assert.match(html, /<option value="nouveau" selected>Un nouveau lieu \(à décrire\)<\/option>/)
    assert.match(html, /<details open class="new-location"/)
    assert.match(html, /<label for="field-newLocationName">Nom du lieu<\/label>/)
  })

  it('creates the location and the item together, and logs both', async () => {
    const response = await louClient.post(
      routes.items.create.action.href(),
      itemFormFields({
        locationId: 'nouveau',
        newLocationOwner: 'me',
        newLocationName: 'Cave de Lou',
        newLocationCity: 'Vitré',
        owner: 'me',
      }),
    )
    const itemId = /\/materiel\/([0-9a-f-]{36})$/.exec(response.location ?? '')?.[1] ?? ''
    const item = await findItemById(db, itemId)
    assert.equal(item?.owner_user_id, lou.id)
    const place = await findLocationById(db, item?.location_id ?? '')
    assert.equal(place?.name, 'Cave de Lou')
    assert.equal(place?.city, 'Vitré')
    assert.equal(place?.user_id, lou.id)
    const log = await db.exec(sql`select action from audit_log
      where entity in ('item', 'location') order by action`)
    assert.deepEqual(
      (log.rows ?? []).map((row) => row.action),
      ['item.created', 'location.created'],
    )
  })

  it('asks for the name and city, and creates nothing until they are given', async () => {
    const response = await louClient.post(
      routes.items.create.action.href(),
      itemFormFields({ locationId: 'nouveau', newLocationOwner: 'me', owner: 'me' }),
    )
    assert.equal(response.status, 400)
    assert.match(response.text, /<details open class="new-location"/)
    assert.match(response.text, /field-newLocationName-error/)
    assert.match(response.text, /field-newLocationCity-error/)
    const n = await db.exec(sql`select (select count(*)::int from items) as i,
      (select count(*)::int from locations) as l`)
    assert.deepEqual(n.rows?.[0], { i: 0, l: 0 })
  })

  it('refuses a new location for a collectif I do not manage', async () => {
    const response = await louClient.post(
      routes.items.create.action.href(),
      itemFormFields({
        locationId: 'nouveau',
        newLocationOwner: `collectif:${frog.id}`,
        newLocationName: 'Faux local',
        newLocationCity: 'Rennes',
        owner: 'me',
      }),
    )
    assert.equal(response.status, 403)
    const n = await db.exec(sql`select count(*)::int as n from locations`)
    assert.equal(n.rows?.[0]?.n, 0)
  })

  it("lets a responsible create the collectif's location for its item", async () => {
    const rita = app.client()
    await signIn(app, rita, 'rita@example.org')
    const response = await rita.post(
      routes.items.create.action.href(),
      itemFormFields({
        locationId: 'nouveau',
        newLocationOwner: `collectif:${frog.id}`,
        newLocationName: 'Local du FROG',
        newLocationCity: 'Rennes',
        owner: `collectif:${frog.id}`,
      }),
    )
    const itemId = /\/materiel\/([0-9a-f-]{36})$/.exec(response.location ?? '')?.[1] ?? ''
    const item = await findItemById(db, itemId)
    assert.equal(item?.owner_collectif_id, frog.id)
    assert.equal((await findLocationById(db, item?.location_id ?? ''))?.collectif_id, frog.id)
  })
})
