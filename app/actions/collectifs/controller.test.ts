import * as assert from 'remix/assert'
import type { Database } from 'remix/data-table'
import { after, before, beforeEach, describe, it } from 'remix/test'

import { createTestApp } from '../../../test/app.ts'
import { signIn } from '../../../test/auth.ts'
import { openTestDatabase, resetDatabase } from '../../../test/database.ts'
import { createActiveUser } from '../../../test/users.ts'
import { findCollectifHoldingSlug, slugify } from '../../data/collectifs.ts'
import { createUser } from '../../data/users.ts'
import { routes } from '../../routes.ts'
import { withReturnPath } from '../return-path.ts'

const requestUrl = routes.collectifs.request.action.href()

describe('request a new collectif (US-0.3.1)', () => {
  let db: Database

  before(async () => {
    db = await openTestDatabase()
  })
  beforeEach(async () => {
    await resetDatabase(db)
    await createActiveUser(db, 'Camille', 'camille@example.org')
  })
  after(async () => {
    await db.close()
  })

  it('makes slugs from names, ignoring accents, case and punctuation', () => {
    assert.equal(slugify('  Son & Lumière d’Été '), 'son-lumiere-d-ete')
  })

  it('records a pending request and notifies the admins', async () => {
    const app = createTestApp(db, { adminEmails: ['boss@example.org'] })
    const client = app.client()
    await signIn(app, client, 'camille@example.org')

    const response = await client.post(requestUrl, {
      name: 'Les Grenouilles',
      city: 'Fougères',
      description: 'Sono et lumière',
      contactPhone: '01 23 45 67 89',
    })

    assert.equal(response.location, routes.collectifs.index.href())
    const collectif = await findCollectifHoldingSlug(db, 'les-grenouilles')
    assert.equal(collectif?.status, 'pending')
    assert.equal(collectif?.city, 'Fougères')
    assert.equal(collectif?.description, 'Sono et lumière')
    assert.equal(collectif?.contact_phone, '01 23 45 67 89')
    assert.deepEqual(app.mailer.outbox.at(-1)?.to, ['boss@example.org'])
    const list = await client.get(routes.collectifs.index.href())
    assert.match(list.text, /Mes demandes en cours/)
    assert.match(list.text, /Les Grenouilles/)
  })

  it('refuses a name already taken by a pending or active collectif', async () => {
    const app = createTestApp(db)
    const client = app.client()
    await signIn(app, client, 'camille@example.org')
    await client.post(requestUrl, { name: 'Les Grenouilles', city: 'Rennes' })

    const response = await client.post(requestUrl, { name: 'les  grenouilles !', city: 'Rennes' })
    assert.equal(response.status, 400)
    assert.match(response.text, /Un collectif porte déjà ce nom/)
  })

  it('validates the fields in French', async () => {
    const app = createTestApp(db)
    const client = app.client()
    await signIn(app, client, 'camille@example.org')

    const response = await client.post(requestUrl, { name: '', contactPhone: 'abc' })
    assert.equal(response.status, 400)
    assert.match(response.text, /Ce champ est obligatoire/)
    assert.match(response.text, /<input [^>]*name="city"[^>]*aria-invalid="true"/)
    assert.match(response.text, /Numéro de téléphone invalide/)
  })

  it('is refused to a visitor and to a pending user', async () => {
    await createUser(db, { name: 'Pat', email: 'pat@example.org' })
    const app = createTestApp(db)

    const visitor = await app.client().post(requestUrl, { name: 'X' }, { csrf: false })
    assert.equal(visitor.status, 403)
    const visitorPage = await app.client().get(routes.collectifs.request.index.href())
    assert.equal(
      visitorPage.location,
      withReturnPath(routes.signIn.form.index.href(), routes.collectifs.request.index.href()),
    )

    const pending = app.client()
    await signIn(app, pending, 'pat@example.org')
    const response = await pending.post(requestUrl, { name: 'X' })
    assert.equal(response.location, routes.account.status.href())
    assert.equal(await findCollectifHoldingSlug(db, 'x'), null)
  })
})
