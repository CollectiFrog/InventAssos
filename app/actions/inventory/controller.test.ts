import * as assert from 'remix/assert'
import { type Database, sql } from 'remix/data-table'
import { after, before, beforeEach, describe, it } from 'remix/test'

import { createTestApp, type TestApp } from '../../../test/app.ts'
import { signIn } from '../../../test/auth.ts'
import { openTestDatabase, resetDatabase } from '../../../test/database.ts'
import { createTestItem } from '../../../test/items.ts'
import { createTestLocation } from '../../../test/locations.ts'
import { createActiveUser } from '../../../test/users.ts'
import { createUser } from '../../data/users.ts'
import { routes } from '../../routes.ts'

describe('browse the whole inventory (US-0.6.1)', () => {
  let db: Database
  let app: TestApp

  before(async () => {
    db = await openTestDatabase()
  })
  beforeEach(async () => {
    await resetDatabase(db)
    const max = await createActiveUser(db, 'Max', 'max@example.org')
    await createActiveUser(db, 'Lou', 'lou@example.org')
    await createUser(db, { name: 'Pat', email: 'pat@example.org' })
    const garage = await createTestLocation(db, { userId: max.id }, 'Garage')
    for (let n = 1; n <= 30; n++) {
      await createTestItem(db, {
        locationId: garage.id,
        owner: { userId: max.id },
        createdBy: max.id,
        name: `Objet ${String(n).padStart(2, '0')}`,
      })
    }
    await db.exec(
      sql`update items set archived_at = now(), archive_reason = 'sold' where name = 'Objet 30'`,
    )
    app = createTestApp(db)
  })
  after(async () => {
    await db.close()
  })

  it("lists everybody's active items, 24 per page, with the city and never the address", async () => {
    const lou = app.client()
    await signIn(app, lou, 'lou@example.org')

    const first = await lou.get(routes.inventory.index.href())
    assert.equal(first.status, 200)
    assert.match(first.text, /29 objets/)
    assert.equal(first.text.match(/class="card"/g)?.length, 24)
    assert.match(first.text, /Objet 01/)
    assert.match(first.text, /Rennes/)
    assert.doesNotMatch(first.text, /12 rue Secrète/)
    assert.match(first.text, /Page 1 sur 2/)

    const second = await lou.get(`${routes.inventory.index.href()}?page=2`)
    assert.equal(second.text.match(/class="card"/g)?.length, 5)
    assert.match(second.text, /Objet 29/)
    assert.doesNotMatch(second.text, /Objet 30/)
  })

  it('is for validated users only', async () => {
    const visitor = await app.client().get(routes.inventory.index.href())
    assert.equal(visitor.location, routes.signIn.form.index.href())

    const pending = app.client()
    await signIn(app, pending, 'pat@example.org')
    assert.equal(
      (await pending.get(routes.inventory.index.href())).location,
      routes.account.status.href(),
    )
  })
})
