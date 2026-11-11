import * as assert from 'remix/assert'
import type { Database } from 'remix/data-table'
import { after, before, beforeEach, describe, it } from 'remix/test'

import { createTestApp, type TestApp, type TestClient } from '../../../../test/app.ts'
import { signIn } from '../../../../test/auth.ts'
import { createPendingCollectif } from '../../../../test/collectifs.ts'
import { openTestDatabase, resetDatabase } from '../../../../test/database.ts'
import { createActiveUser } from '../../../../test/users.ts'
import { listEntityHistory } from '../../../data/audit-log.ts'
import { findCollectifById } from '../../../data/collectifs.ts'
import { findResponsible } from '../../../data/responsibles.ts'
import type { Collectif, User } from '../../../data/tables.ts'
import { setUserStatus } from '../../../data/users.ts'
import { routes } from '../../../routes.ts'

describe('accept or reject a collectif (US-0.3.2)', () => {
  let db: Database
  let app: TestApp
  let admin: TestClient
  let requester: User
  let collectif: Collectif

  before(async () => {
    db = await openTestDatabase()
  })
  beforeEach(async () => {
    await resetDatabase(db)
    requester = await createActiveUser(db, 'Rita', 'rita@example.org')
    collectif = await createPendingCollectif(db, 'Les Grenouilles', requester.id)
    app = createTestApp(db, { adminEmails: ['boss@example.org'] })
    admin = app.client()
    await signIn(app, admin, 'boss@example.org')
    app.mailer.outbox.length = 0
  })
  after(async () => {
    await db.close()
  })

  it('lists the pending collectif with its requester', async () => {
    const page = await admin.get(routes.admin.index.href())
    assert.match(page.text, /Les Grenouilles/)
    assert.match(page.text, /Demandé par Rita/)
  })

  it('accepts: collectif active, requester responsible, e-mail sent, logged', async () => {
    await admin.post(routes.admin.collectifs.approve.href({ collectifId: collectif.id }))

    assert.equal((await findCollectifById(db, collectif.id))?.status, 'active')
    assert.equal((await findResponsible(db, requester.id, collectif.id))?.status, 'active')
    assert.equal(app.mailer.outbox[0]?.to, 'rita@example.org')
    assert.match(app.mailer.outbox[0]?.subject ?? '', /validé/)
    const [entry] = await listEntityHistory(db, 'collectif', collectif.id)
    assert.equal(entry?.action, 'collectif.approved')

    const rita = app.client()
    await signIn(app, rita, 'rita@example.org')
    assert.match(
      (await rita.get(routes.collectifs.index.href())).text,
      /Mes collectifs<\/h2>[\s\S]*Les Grenouilles/,
    )
  })

  it('rejects with a reason: e-mailed, kept out of the log, name freed', async () => {
    await admin.post(routes.admin.collectifs.reject.href({ collectifId: collectif.id }), {
      reason: 'Doublon de Grenouilles Unies',
    })

    const rejected = await findCollectifById(db, collectif.id)
    assert.equal(rejected?.status, 'rejected')
    assert.equal(rejected?.rejection_reason, 'Doublon de Grenouilles Unies')
    assert.match(app.mailer.outbox[0]?.text ?? '', /Motif : Doublon/)
    assert.doesNotMatch(
      JSON.stringify(await listEntityHistory(db, 'collectif', collectif.id)),
      /Doublon/,
    )
    assert.equal(await findResponsible(db, requester.id, collectif.id), null)

    await createPendingCollectif(db, 'Les Grenouilles', requester.id)
  })

  it('cannot accept when the requester is no longer active', async () => {
    await setUserStatus(db, requester.id, 'disabled')
    await admin.post(routes.admin.collectifs.approve.href({ collectifId: collectif.id }))

    assert.equal((await findCollectifById(db, collectif.id))?.status, 'pending')
  })

  it('refuses both actions to a validated user who is not admin (403)', async () => {
    const client = app.client()
    await signIn(app, client, 'rita@example.org')

    const approve = await client.post(
      routes.admin.collectifs.approve.href({ collectifId: collectif.id }),
    )
    const reject = await client.post(
      routes.admin.collectifs.reject.href({ collectifId: collectif.id }),
    )
    assert.equal(approve.status, 403)
    assert.equal(reject.status, 403)
    assert.equal((await findCollectifById(db, collectif.id))?.status, 'pending')
  })
})
