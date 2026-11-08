import * as assert from 'remix/assert'
import { type Database, sql } from 'remix/data-table'
import { after, before, beforeEach, describe, it } from 'remix/test'

import { createTestApp, type TestApp } from '../../../test/app.ts'
import { signIn } from '../../../test/auth.ts'
import { createActiveCollectif } from '../../../test/collectifs.ts'
import { openTestDatabase, resetDatabase } from '../../../test/database.ts'
import { createTestLocation } from '../../../test/locations.ts'
import { createActiveUser } from '../../../test/users.ts'
import { listEntityHistory } from '../../data/audit-log.ts'
import { findLocationById, listCollectifLocations } from '../../data/locations.ts'
import type { Collectif, User } from '../../data/tables.ts'
import { routes } from '../../routes.ts'

describe("a collectif's locations (US-0.4.1)", () => {
  let db: Database
  let app: TestApp
  let grenouilles: Collectif
  let crapauds: Collectif
  let rita: User

  before(async () => {
    db = await openTestDatabase()
  })
  beforeEach(async () => {
    await resetDatabase(db)
    rita = await createActiveUser(db, 'Rita', 'rita@example.org')
    const otto = await createActiveUser(db, 'Otto', 'otto@example.org')
    await createActiveUser(db, 'Max', 'max@example.org')
    grenouilles = await createActiveCollectif(db, 'Les Grenouilles', rita.id)
    crapauds = await createActiveCollectif(db, 'Les Crapauds', otto.id)
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

  const fields = { name: 'Local Dupont', city: 'Rennes', address: '1 rue X', notes: '' }

  it('refuses, in the database, a location with two owners or none', async () => {
    await assert.rejects(db.exec(sql`insert into locations (name, city) values ('x', 'y')`))
    await assert.rejects(
      db.exec(sql`
        insert into locations (name, city, collectif_id, user_id)
        values ('x', 'y', ${grenouilles.id}, ${rita.id})
      `),
    )
  })

  it("lets a responsible create, edit and delete their collectif's locations", async () => {
    const client = await clientFor('rita@example.org')

    const created = await client.post(routes.locations.create.action.href(), {
      owner: `collectif:${grenouilles.id}`,
      ...fields,
    })
    assert.equal(created.location, routes.locations.index.href())
    const [location] = await listCollectifLocations(db, grenouilles.id)
    assert.equal(location?.name, 'Local Dupont')
    assert.match((await client.get(routes.locations.index.href())).text, /Local Dupont/)
    const page = await client.get(routes.collectifs.show.href({ slug: grenouilles.slug }))
    assert.match(page.text, /Local Dupont · Rennes/)

    const id = location?.id ?? ''
    await client.post(routes.locations.edit.action.href({ locationId: id }), {
      ...fields,
      name: 'Local renommé',
    })
    assert.equal((await findLocationById(db, id))?.name, 'Local renommé')

    await client.post(routes.locations.remove.href({ locationId: id }))
    assert.equal(await findLocationById(db, id), null)
    const actions = (await listEntityHistory(db, 'location', id)).map((e) => e.action)
    assert.deepEqual(actions, ['location.created', 'location.updated', 'location.deleted'])
  })

  it('lets a platform admin create a location for any collectif', async () => {
    const client = await clientFor('boss@example.org')
    await client.post(routes.locations.create.action.href(), {
      owner: `collectif:${crapauds.id}`,
      ...fields,
    })
    assert.equal((await listCollectifLocations(db, crapauds.id)).length, 1)
  })

  it('refuses a responsible of another collectif (403), for create, edit and delete', async () => {
    const location = await createTestLocation(db, { collectifId: grenouilles.id })
    const otto = await clientFor('otto@example.org')

    const create = await otto.post(routes.locations.create.action.href(), {
      owner: `collectif:${grenouilles.id}`,
      ...fields,
    })
    const edit = await otto.post(
      routes.locations.edit.action.href({ locationId: location.id }),
      fields,
    )
    const remove = await otto.post(routes.locations.remove.href({ locationId: location.id }))

    assert.deepEqual([create.status, edit.status, remove.status], [403, 403, 403])
    assert.equal((await listCollectifLocations(db, grenouilles.id)).length, 1)
    assert.equal((await findLocationById(db, location.id))?.name, 'Local')
  })

  it("refuses a collectif's location to a validated user who does not manage it (403)", async () => {
    const max = await clientFor('max@example.org')

    const form = await max.get(routes.locations.create.index.href())
    assert.doesNotMatch(form.text, new RegExp(`collectif:${grenouilles.id}`))
    const response = await max.post(routes.locations.create.action.href(), {
      owner: `collectif:${grenouilles.id}`,
      ...fields,
    })
    assert.equal(response.status, 403)
  })

  it('validates the form in French', async () => {
    const client = await clientFor('rita@example.org')
    const response = await client.post(routes.locations.create.action.href(), {
      owner: `collectif:${grenouilles.id}`,
      name: '',
      city: '',
    })
    assert.equal(response.status, 400)
    assert.match(response.text, /Ce champ est obligatoire/)
  })
})
