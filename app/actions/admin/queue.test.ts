import * as assert from 'remix/assert'
import type { Database } from 'remix/data-table'
import { after, before, beforeEach, describe, it } from 'remix/test'

import { createTestApp } from '../../../test/app.ts'
import { signIn } from '../../../test/auth.ts'
import { createActiveCollectif, createPendingCollectif } from '../../../test/collectifs.ts'
import { openTestDatabase, resetDatabase } from '../../../test/database.ts'
import { createActiveUser } from '../../../test/users.ts'
import { setResponsible } from '../../data/responsibles.ts'
import { createUser } from '../../data/users.ts'
import { routes } from '../../routes.ts'

describe('one admin queue (US-0.3.7)', () => {
  let db: Database

  before(async () => {
    db = await openTestDatabase()
  })
  beforeEach(async () => {
    await resetDatabase(db)
  })
  after(async () => {
    await db.close()
  })

  it('lists pending accounts, collectifs and responsibles with a count per kind', async () => {
    await createUser(db, { name: 'Pat Pending', email: 'pat@example.org' })
    const rita = await createActiveUser(db, 'Rita', 'rita@example.org')
    const max = await createActiveUser(db, 'Max', 'max@example.org')
    await createPendingCollectif(db, 'Les Crapauds', rita.id)
    const grenouilles = await createActiveCollectif(db, 'Les Grenouilles', rita.id)
    await setResponsible(db, { userId: max.id, collectifId: grenouilles.id, status: 'pending' })
    const app = createTestApp(db, { adminEmails: ['boss@example.org'] })
    const admin = app.client()
    await signIn(app, admin, 'boss@example.org')

    const page = await admin.get(routes.admin.index.href())

    assert.equal(page.status, 200)
    assert.match(page.text, /1 compte en attente/)
    assert.match(page.text, /1 collectif en attente/)
    assert.match(page.text, /1 responsable en attente/)
    assert.match(page.text, /Pat Pending/)
    assert.match(page.text, /Les Crapauds/)
    assert.match(page.text, /veut gérer <strong>Les Grenouilles/)
  })

  it('is refused to a validated user who is not admin (403)', async () => {
    await createActiveUser(db, 'Max', 'max@example.org')
    const app = createTestApp(db)
    const client = app.client()
    await signIn(app, client, 'max@example.org')

    assert.equal((await client.get(routes.admin.index.href())).status, 403)
  })
})
