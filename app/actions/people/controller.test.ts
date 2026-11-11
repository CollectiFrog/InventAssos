import * as assert from 'remix/assert'
import { type Database, sql } from 'remix/data-table'
import { after, before, beforeEach, describe, it } from 'remix/test'

import { createTestApp, type TestApp, type TestClient } from '../../../test/app.ts'
import { signIn } from '../../../test/auth.ts'
import { createActiveCollectif } from '../../../test/collectifs.ts'
import { openTestDatabase, resetDatabase } from '../../../test/database.ts'
import { createTestItem } from '../../../test/items.ts'
import { createTestLocation } from '../../../test/locations.ts'
import { createActiveUser } from '../../../test/users.ts'
import { setResponsible } from '../../data/responsibles.ts'
import type { Collectif, Item, User } from '../../data/tables.ts'
import { createUser } from '../../data/users.ts'
import { routes } from '../../routes.ts'

describe('collectif and person equipment pages (US-0.6.4)', () => {
  let db: Database
  let app: TestApp
  let lou: TestClient
  let collectif: Collectif
  let max: User
  let maxItem: Item

  before(async () => {
    db = await openTestDatabase()
  })
  beforeEach(async () => {
    await resetDatabase(db)
    const rita = await createActiveUser(db, 'Rita', 'rita@example.org')
    max = await createActiveUser(db, 'Max', 'max@example.org')
    const louUser = await createActiveUser(db, 'Lou', 'lou@example.org')
    collectif = await createActiveCollectif(db, 'Les Grenouilles', rita.id)
    // Lou shares Les Rainettes with Max, not Les Grenouilles (ADR 0021).
    const rainettes = await createActiveCollectif(db, 'Les Rainettes', louUser.id)
    await setResponsible(db, { userId: max.id, collectifId: rainettes.id, status: 'active' })
    const local = await createTestLocation(db, { collectifId: collectif.id }, 'Local')
    const garage = await createTestLocation(db, { userId: max.id }, 'Garage')
    await createTestItem(db, {
      locationId: local.id,
      owner: { collectifId: collectif.id },
      createdBy: rita.id,
      name: 'Console du collectif',
    })
    const archived = await createTestItem(db, {
      locationId: local.id,
      owner: { collectifId: collectif.id },
      createdBy: rita.id,
      name: 'Vieille console',
    })
    await db.exec(
      sql`update items set archived_at = now(), archive_reason = 'sold' where id = ${archived.id}`,
    )
    // Max's item deposited at the collectif: it is Max's, not the collectif's.
    maxItem = await createTestItem(db, {
      locationId: local.id,
      owner: { userId: max.id },
      createdBy: rita.id,
      name: 'Ampli de Max',
    })
    await createTestItem(db, {
      locationId: garage.id,
      owner: { userId: max.id },
      createdBy: max.id,
      name: 'Enceinte de Max',
    })
    await db.exec(sql`update users set phone = '06 11 22 33 44' where id = ${max.id}`)
    app = createTestApp(db)
    lou = app.client()
    await signIn(app, lou, 'lou@example.org')
  })
  after(async () => {
    await db.close()
  })

  it('lists the active items a collectif owns, then apart the deposits it stores', async () => {
    const rita = app.client()
    await signIn(app, rita, 'rita@example.org')
    const html = (await rita.get(routes.collectifs.show.href({ slug: collectif.slug }))).text
    const [owned = '', deposits = ''] = html.split('Déposé dans nos lieux')
    assert.match(owned, /Console du collectif/)
    assert.doesNotMatch(owned, /Ampli de Max/)
    assert.match(deposits, /Ampli de Max/)
    assert.doesNotMatch(html, /Vieille console/)
  })

  it('shows someone outside a collectif none of its items, locations or people', async () => {
    // The collectif's own city is public (ADR 0023); its locations' cities are not.
    await db.exec(sql`update collectifs set city = 'Pacé' where id = ${collectif.id}`)
    const html = (await lou.get(routes.collectifs.show.href({ slug: collectif.slug }))).text
    assert.match(html, /<h1>Les Grenouilles<\/h1><p class="status">Pacé<\/p>/)
    assert.doesNotMatch(html, /Console du collectif|Local|Rennes|12 rue Secrète|Rita/)
    assert.match(html, /Demander à devenir responsable/)
  })

  it("lists a person's items, wherever they are stored, with their phone and no address", async () => {
    const html = (await lou.get(routes.people.show.href({ userId: max.id }))).text
    assert.match(html, /<h1>Max<\/h1>/)
    assert.match(html, /06 11 22 33 44/)
    assert.match(html, /Ampli de Max/)
    assert.match(html, /Enceinte de Max/)
    assert.doesNotMatch(html, /Console du collectif/)
    assert.doesNotMatch(html, /12 rue Secrète|max@example\.org/)
  })

  it("links an item to its owner's page", async () => {
    const html = (await lou.get(routes.items.show.href({ itemId: maxItem.id }))).text
    assert.match(html, new RegExp(`href="${routes.people.show.href({ userId: max.id })}"`))
  })

  it('answers 404 for a person who shares no collectif with the viewer', async () => {
    const otto = app.client()
    await createActiveUser(db, 'Otto', 'otto@example.org')
    await signIn(app, otto, 'otto@example.org')
    const page = await otto.get(routes.people.show.href({ userId: max.id }))
    assert.equal(page.status, 404)
    assert.doesNotMatch(page.text, /06 11 22 33 44|Ampli de Max/)
  })

  it('shows no page for an account that is not active', async () => {
    const pat = await createUser(db, { name: 'Pat', email: 'pat@example.org' })
    assert.equal((await lou.get(routes.people.show.href({ userId: pat.id }))).status, 404)
  })
})
