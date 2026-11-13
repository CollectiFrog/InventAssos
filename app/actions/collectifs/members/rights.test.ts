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
import { createLocation } from '../../../data/locations.ts'
import type { Collectif, Location } from '../../../data/tables.ts'
import { routes } from '../../../routes.ts'

// V0.8 is done when "a responsible accepts a member who then adds the collectif's equipment".
describe('member rights (US-0.8.5)', () => {
  let db: Database
  let app: TestApp
  let frog: Collectif
  let local: Location
  let nina: TestClient

  before(async () => {
    db = await openTestDatabase()
  })
  beforeEach(async () => {
    await resetDatabase(db)
    const rita = await createActiveUser(db, 'Rita', 'rita@example.org')
    await createActiveUser(db, 'Nina', 'nina@example.org')
    frog = await createActiveCollectif(db, "Collecti'FROG", rita.id)
    local = await createLocation(
      db,
      { collectifId: frog.id },
      { name: 'Local du FROG', city: 'Rennes', address: '12 rue des Ateliers', notes: 'Code 4521' },
    )
    app = createTestApp(db)
    nina = app.client()
    await signIn(app, nina, 'nina@example.org')
    await nina.post(routes.collectifs.join.href({ slug: frog.slug }))
    const ninaId = (await db.exec(sql`select id from users where email = 'nina@example.org'`))
      .rows?.[0]?.id
    const ritaClient = app.client()
    await signIn(app, ritaClient, 'rita@example.org')
    await ritaClient.post(
      routes.collectifs.members.approve.href({ slug: frog.slug, userId: String(ninaId) }),
    )
  })
  after(async () => {
    await db.close()
  })

  it('offers the collectif as owner and its locations in the add form, then adds its equipment', async () => {
    const page = (await nina.get(routes.collectifs.show.href({ slug: frog.slug }))).text
    const add = `${routes.items.create.index.href()}?pour=collectif:${frog.id}`
    assert.match(page, new RegExp(`href="${add.replace('?', '\\?')}"`))
    const form = (await nina.get(add)).text
    assert.match(form, new RegExp(`<option value="collectif:${frog.id}" selected>`))
    assert.match(form, new RegExp(`<option value="${local.id}"`))

    const response = await nina.post(
      routes.items.create.action.href(),
      itemFormFields({ locationId: local.id, owner: `collectif:${frog.id}`, name: 'Lyre DMX' }),
    )
    const itemId = /\/materiel\/([0-9a-f-]{36})$/.exec(response.location ?? '')?.[1] ?? ''
    assert.equal((await findItemById(db, itemId))?.owner_collectif_id, frog.id)
    assert.match(
      (await nina.get(routes.collectifs.show.href({ slug: frog.slug }))).text,
      /Lyre DMX/,
    )
  })

  it("edits and archives the collectif's equipment", async () => {
    const response = await nina.post(
      routes.items.create.action.href(),
      itemFormFields({ locationId: local.id, owner: `collectif:${frog.id}`, name: 'Lyre DMX' }),
    )
    const itemId = /\/materiel\/([0-9a-f-]{36})$/.exec(response.location ?? '')?.[1] ?? ''
    await nina.post(
      routes.items.edit.action.href({ itemId }),
      itemFormFields({ name: 'Lyre DMX 2', condition: 'repair' }),
    )
    assert.equal((await findItemById(db, itemId))?.condition, 'repair')
    await nina.post(routes.items.archive.action.href({ itemId }), { reason: 'broken' })
    assert.equal((await findItemById(db, itemId))?.archive_reason, 'broken')
  })

  it("sees the full address of the collectif's locations, but does not manage them", async () => {
    const page = (await nina.get(routes.locations.show.href({ locationId: local.id }))).text
    assert.match(page, /12 rue des Ateliers/)
    assert.match(page, /Code 4521/)
    const places = (await nina.get(routes.collectifs.places.href({ slug: frog.slug }))).text
    assert.doesNotMatch(places, /Ajouter un lieu/)
    const edit = await nina.post(routes.locations.edit.action.href({ locationId: local.id }), {
      name: 'Renommé',
      city: 'Rennes',
    })
    assert.equal(edit.status, 403)
  })
})
