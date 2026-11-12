import * as assert from 'remix/assert'
import type { Database } from 'remix/data-table'
import { after, before, beforeEach, describe, it } from 'remix/test'

import { createTestApp, type TestApp, type TestClient } from '../../../../test/app.ts'
import { signIn } from '../../../../test/auth.ts'
import { createActiveCollectif } from '../../../../test/collectifs.ts'
import { openTestDatabase, resetDatabase } from '../../../../test/database.ts'
import { createActiveUser } from '../../../../test/users.ts'
import { listEntityHistory } from '../../../data/audit-log.ts'
import { findResponsible, setResponsible } from '../../../data/members.ts'
import type { Collectif, User } from '../../../data/tables.ts'
import { routes } from '../../../routes.ts'

describe('accept or reject a responsible request (US-0.3.4)', () => {
  let db: Database
  let app: TestApp
  let admin: TestClient
  let collectif: Collectif
  let max: User

  before(async () => {
    db = await openTestDatabase()
  })
  beforeEach(async () => {
    await resetDatabase(db)
    const rita = await createActiveUser(db, 'Rita', 'rita@example.org')
    collectif = await createActiveCollectif(db, 'Les Grenouilles', rita.id)
    max = await createActiveUser(db, 'Max', 'max@example.org')
    await setResponsible(db, { userId: max.id, collectifId: collectif.id, status: 'pending' })
    app = createTestApp(db, { adminEmails: ['boss@example.org'] })
    admin = app.client()
    await signIn(app, admin, 'boss@example.org')
    app.mailer.outbox.length = 0
  })
  after(async () => {
    await db.close()
  })

  it('lists the request in the admin queue', async () => {
    const page = await admin.get(routes.admin.index.href())
    assert.match(page.text, /<strong>Max<\/strong> \(max@example\.org\) veut gérer/)
  })

  it('accepts: the person becomes responsible, is e-mailed, and it is logged', async () => {
    const ids = { collectifId: collectif.id, userId: max.id }
    await admin.post(routes.admin.responsibles.approve.href(ids))

    assert.equal((await findResponsible(db, max.id, collectif.id))?.status, 'active')
    assert.equal(app.mailer.outbox[0]?.to, 'max@example.org')
    const entries = await listEntityHistory(db, 'collectif', collectif.id)
    assert.equal(entries.at(-1)?.action, 'responsible.approved')

    const client = app.client()
    await signIn(app, client, 'max@example.org')
    const page = await client.get(routes.collectifs.show.href({ slug: collectif.slug }))
    assert.match(page.text, /Vous êtes responsable/)
  })

  it('rejects: the person is e-mailed and may ask again later', async () => {
    const ids = { collectifId: collectif.id, userId: max.id }
    await admin.post(routes.admin.responsibles.reject.href(ids))

    assert.equal((await findResponsible(db, max.id, collectif.id))?.status, 'rejected')
    assert.match(app.mailer.outbox[0]?.text ?? '', /n’a pas été acceptée/)
  })

  it('refuses both actions to a validated user who is not admin (403)', async () => {
    const client = app.client()
    await signIn(app, client, 'rita@example.org')
    const ids = { collectifId: collectif.id, userId: max.id }

    assert.equal((await client.post(routes.admin.responsibles.approve.href(ids))).status, 403)
    assert.equal((await client.post(routes.admin.responsibles.reject.href(ids))).status, 403)
    assert.equal((await findResponsible(db, max.id, collectif.id))?.status, 'pending')
  })
})
