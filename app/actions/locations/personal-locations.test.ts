import * as assert from 'remix/assert'
import type { Database } from 'remix/data-table'
import { after, before, beforeEach, describe, it } from 'remix/test'

import { createTestApp, type TestApp } from '../../../test/app.ts'
import { signIn } from '../../../test/auth.ts'
import { openTestDatabase, resetDatabase } from '../../../test/database.ts'
import { createTestLocation } from '../../../test/locations.ts'
import { createActiveUser } from '../../../test/users.ts'
import { findLocationById } from '../../data/locations.ts'
import type { User } from '../../data/tables.ts'
import { findUserByEmail } from '../../data/users.ts'
import { routes } from '../../routes.ts'

describe('personal locations (US-0.4.2)', () => {
  let db: Database
  let app: TestApp
  let max: User

  before(async () => {
    db = await openTestDatabase()
  })
  beforeEach(async () => {
    await resetDatabase(db)
    max = await createActiveUser(db, 'Max', 'max@example.org')
    await createActiveUser(db, 'Lou', 'lou@example.org')
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

  const fields = { name: 'Mon garage', city: 'Vitré', address: '3 impasse', notes: '' }

  it('lets any validated user create, edit and delete their own locations', async () => {
    const client = await clientFor('max@example.org')
    const form = await client.get(routes.locations.create.index.href())
    assert.match(form.text, /Moi \(lieu personnel\)/)

    await client.post(routes.locations.create.action.href(), { owner: 'me', ...fields })
    const page = await client.get(routes.locations.index.href())
    assert.match(page.text, /Mon garage/)
    const id = /\/lieux\/([0-9a-f-]{36})\/modifier/.exec(page.text)?.[1] ?? ''
    const location = await findLocationById(db, id)
    assert.equal(location?.user_id, max.id)
    assert.equal(location?.collectif_id, null)

    await client.post(routes.locations.edit.action.href({ locationId: id }), {
      ...fields,
      city: 'Fougères',
    })
    assert.equal((await findLocationById(db, id))?.city, 'Fougères')
    await client.post(routes.locations.remove.href({ locationId: id }))
    assert.equal(await findLocationById(db, id), null)
  })

  it("refuses to edit or delete someone else's personal location (403), even for an admin", async () => {
    const location = await createTestLocation(db, { userId: max.id }, 'Garage de Max')

    for (const email of ['lou@example.org', 'boss@example.org']) {
      const client = await clientFor(email)
      const page = await client.get(routes.locations.edit.index.href({ locationId: location.id }))
      const edit = await client.post(
        routes.locations.edit.action.href({ locationId: location.id }),
        fields,
      )
      const remove = await client.post(routes.locations.remove.href({ locationId: location.id }))
      assert.deepEqual([page.status, edit.status, remove.status], [403, 403, 403], email)
    }
    assert.equal((await findLocationById(db, location.id))?.name, 'Garage de Max')
  })

  it('lets an admin manage their own personal locations', async () => {
    const client = await clientFor('boss@example.org')
    await client.post(routes.locations.create.action.href(), { owner: 'me', ...fields })
    const boss = await findUserByEmail(db, 'boss@example.org')
    assert.match((await client.get(routes.locations.index.href())).text, /Mon garage/)
    assert.ok(boss)
  })
})
