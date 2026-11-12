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

describe('remove a responsible (US-0.3.6)', () => {
  let db: Database
  let app: TestApp
  let admin: TestClient
  let collectif: Collectif
  let rita: User
  let max: User

  before(async () => {
    db = await openTestDatabase()
  })
  beforeEach(async () => {
    await resetDatabase(db)
    rita = await createActiveUser(db, 'Rita', 'rita@example.org')
    max = await createActiveUser(db, 'Max', 'max@example.org')
    collectif = await createActiveCollectif(db, 'Les Grenouilles', rita.id)
    app = createTestApp(db, { adminEmails: ['boss@example.org'] })
    admin = app.client()
    await signIn(app, admin, 'boss@example.org')
    app.mailer.outbox.length = 0
  })
  after(async () => {
    await db.close()
  })

  function removeUrl(userId: string) {
    return routes.admin.responsibles.remove.href({ collectifId: collectif.id, userId })
  }

  it('shows the remove forms to the admin on the collectif page', async () => {
    const page = await admin.get(routes.collectifs.people.href({ slug: collectif.slug }))
    assert.match(page.text, /Gérer les responsables/)
    assert.match(page.text, new RegExp(removeUrl(rita.id)))
  })

  it('refuses to remove the last responsible without a replacement', async () => {
    await admin.post(removeUrl(rita.id))

    assert.equal((await findResponsible(db, rita.id, collectif.id))?.status, 'active')
    const page = await admin.get(routes.collectifs.show.href({ slug: collectif.slug }))
    assert.match(page.text, /dernier responsable/)
    assert.equal(app.mailer.outbox.length, 0)
  })

  it('removes the last responsible when a validated replacement is named', async () => {
    await admin.post(removeUrl(rita.id), { replacementEmail: 'max@example.org' })

    assert.equal((await findResponsible(db, rita.id, collectif.id))?.status, 'removed')
    assert.equal((await findResponsible(db, max.id, collectif.id))?.status, 'active')
    assert.equal(app.mailer.outbox[0]?.to, 'rita@example.org')
    const entries = await listEntityHistory(db, 'collectif', collectif.id)
    assert.equal(entries.at(-1)?.action, 'responsible.removed')
  })

  it('removes one responsible when another remains', async () => {
    await setResponsible(db, { userId: max.id, collectifId: collectif.id, status: 'active' })
    await admin.post(removeUrl(rita.id))

    assert.equal((await findResponsible(db, rita.id, collectif.id))?.status, 'removed')
  })

  it('refuses a replacement that is not a validated user', async () => {
    await admin.post(removeUrl(rita.id), { replacementEmail: 'nobody@example.org' })
    assert.equal((await findResponsible(db, rita.id, collectif.id))?.status, 'active')
  })

  it('refuses removal to a responsible who is not admin (403)', async () => {
    await setResponsible(db, { userId: max.id, collectifId: collectif.id, status: 'active' })
    const client = app.client()
    await signIn(app, client, 'max@example.org')

    const response = await client.post(removeUrl(rita.id))
    assert.equal(response.status, 403)
    assert.equal((await findResponsible(db, rita.id, collectif.id))?.status, 'active')
    const page = await client.get(routes.collectifs.show.href({ slug: collectif.slug }))
    assert.doesNotMatch(page.text, /Gérer les responsables/)
  })
})
