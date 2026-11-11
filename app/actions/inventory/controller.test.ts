import * as assert from 'remix/assert'
import { type Database, sql } from 'remix/data-table'
import { after, before, beforeEach, describe, it } from 'remix/test'

import { createTestApp, type TestApp } from '../../../test/app.ts'
import { signIn } from '../../../test/auth.ts'
import { createActiveCollectif } from '../../../test/collectifs.ts'
import { openTestDatabase, resetDatabase } from '../../../test/database.ts'
import { createTestItem } from '../../../test/items.ts'
import { createTestLocation } from '../../../test/locations.ts'
import { createActiveUser } from '../../../test/users.ts'
import { setResponsible } from '../../data/responsibles.ts'
import { createUser } from '../../data/users.ts'
import { routes } from '../../routes.ts'
import { withReturnPath } from '../return-path.ts'

describe('browse the equipment of my collectifs (US-0.6.1, US-0.7.11)', () => {
  let db: Database
  let app: TestApp

  before(async () => {
    db = await openTestDatabase()
  })
  beforeEach(async () => {
    await resetDatabase(db)
    const max = await createActiveUser(db, 'Max', 'max@example.org')
    const lou = await createActiveUser(db, 'Lou', 'lou@example.org')
    await createActiveUser(db, 'Otto', 'otto@example.org')
    // Lou shares a collectif with Max, so she sees his items; Otto shares none (ADR 0021).
    const collectif = await createActiveCollectif(db, 'Les Grenouilles', max.id)
    await setResponsible(db, { userId: lou.id, collectifId: collectif.id, status: 'active' })
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
    app = createTestApp(db, { adminEmails: ['boss@example.org'] })
  })
  after(async () => {
    await db.close()
  })

  it('lists the active items I may see, 24 per page, with the city and never the address', async () => {
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

  it('shows nothing of a collectif I do not belong to; admins still see everything', async () => {
    const otto = app.client()
    await signIn(app, otto, 'otto@example.org')
    const page = (await otto.get(routes.inventory.index.href())).text
    assert.doesNotMatch(page, /Objet \d\d/)
    assert.doesNotMatch(page, /Rennes/)
    // The collectif filter offers only my collectifs.
    assert.doesNotMatch(page, /Les Grenouilles/)

    const boss = app.client()
    await signIn(app, boss, 'boss@example.org')
    assert.match((await boss.get(routes.inventory.index.href())).text, /29 objets/)
  })

  it('is for validated users only', async () => {
    const visitor = await app.client().get(routes.inventory.index.href())
    assert.equal(
      visitor.location,
      withReturnPath(routes.signIn.form.index.href(), routes.inventory.index.href()),
    )

    const pending = app.client()
    await signIn(app, pending, 'pat@example.org')
    assert.equal(
      (await pending.get(routes.inventory.index.href())).location,
      routes.account.status.href(),
    )
  })
})
