import * as assert from 'remix/assert'
import type { Database } from 'remix/data-table'
import { after, before, beforeEach, describe, it } from 'remix/test'

import { createTestApp, type TestApp } from '../../../../test/app.ts'
import { signIn } from '../../../../test/auth.ts'
import { createActiveCollectif } from '../../../../test/collectifs.ts'
import { openTestDatabase, resetDatabase } from '../../../../test/database.ts'
import { createActiveUser } from '../../../../test/users.ts'
import { listEntityHistory } from '../../../data/audit-log.ts'
import { findCollectifById } from '../../../data/collectifs.ts'
import type { Collectif } from '../../../data/tables.ts'
import { routes } from '../../../routes.ts'

describe("edit a collectif's profile (US-0.3.5)", () => {
  let db: Database
  let app: TestApp
  let grenouilles: Collectif

  before(async () => {
    db = await openTestDatabase()
  })
  beforeEach(async () => {
    await resetDatabase(db)
    const rita = await createActiveUser(db, 'Rita', 'rita@example.org')
    const otto = await createActiveUser(db, 'Otto', 'otto@example.org')
    await createActiveUser(db, 'Max', 'max@example.org')
    grenouilles = await createActiveCollectif(db, 'Les Grenouilles', rita.id)
    await createActiveCollectif(db, 'Les Crapauds', otto.id)
    app = createTestApp(db, { adminEmails: ['boss@example.org'] })
  })
  after(async () => {
    await db.close()
  })

  async function edit(email: string, fields: Record<string, string>) {
    const client = app.client()
    await signIn(app, client, email)
    return client.post(routes.collectifs.edit.action.href({ slug: grenouilles.slug }), fields)
  }

  it('lets a responsible of C edit it, and logs the change', async () => {
    const response = await edit('rita@example.org', {
      description: 'Sono, lumière',
      contactPhone: '06 00 00 00 00',
    })

    assert.equal(response.location, routes.collectifs.show.href({ slug: grenouilles.slug }))
    const updated = await findCollectifById(db, grenouilles.id)
    assert.equal(updated?.description, 'Sono, lumière')
    assert.equal(updated?.contact_phone, '06 00 00 00 00')
    const entries = await listEntityHistory(db, 'collectif', grenouilles.id)
    assert.equal(entries.at(-1)?.action, 'collectif.updated')
  })

  it('lets a platform admin edit any collectif', async () => {
    await edit('boss@example.org', { description: 'Par l’admin' })
    assert.equal((await findCollectifById(db, grenouilles.id))?.description, 'Par l’admin')
  })

  it('refuses a responsible of another collectif and a plain user (403)', async () => {
    for (const email of ['otto@example.org', 'max@example.org']) {
      const response = await edit(email, { description: 'Pirate' })
      assert.equal(response.status, 403, email)
    }
    assert.equal((await findCollectifById(db, grenouilles.id))?.description, '')
  })

  it('shows the edit button only to those who may edit', async () => {
    const rita = app.client()
    await signIn(app, rita, 'rita@example.org')
    const max = app.client()
    await signIn(app, max, 'max@example.org')
    const url = routes.collectifs.show.href({ slug: grenouilles.slug })

    assert.match((await rita.get(url)).text, /Modifier la présentation/)
    assert.doesNotMatch((await max.get(url)).text, /Modifier la présentation/)
  })

  it('shows errors on invalid input', async () => {
    const response = await edit('rita@example.org', { contactPhone: 'nope' })
    assert.equal(response.status, 400)
    assert.match(response.text, /Numéro de téléphone invalide/)
  })
})
