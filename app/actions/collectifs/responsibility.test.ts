import * as assert from 'remix/assert'
import type { Database } from 'remix/data-table'
import { after, before, beforeEach, describe, it } from 'remix/test'

import { createTestApp } from '../../../test/app.ts'
import { signIn } from '../../../test/auth.ts'
import { createActiveCollectif } from '../../../test/collectifs.ts'
import { openTestDatabase, resetDatabase } from '../../../test/database.ts'
import { createActiveUser } from '../../../test/users.ts'
import { findResponsible, setResponsible } from '../../data/responsibles.ts'
import type { Collectif, User } from '../../data/tables.ts'
import { routes } from '../../routes.ts'

describe('ask to become responsible (US-0.3.3)', () => {
  let db: Database
  let collectif: Collectif
  let member: User

  before(async () => {
    db = await openTestDatabase()
  })
  beforeEach(async () => {
    await resetDatabase(db)
    const rita = await createActiveUser(db, 'Rita', 'rita@example.org')
    collectif = await createActiveCollectif(db, 'Les Grenouilles', rita.id)
    member = await createActiveUser(db, 'Max', 'max@example.org')
  })
  after(async () => {
    await db.close()
  })

  it('shows the request button to an outsider, and the responsibles to them only', async () => {
    const app = createTestApp(db)
    const client = app.client()
    await signIn(app, client, 'max@example.org')

    const page = await client.get(routes.collectifs.show.href({ slug: collectif.slug }))
    assert.equal(page.status, 200)
    assert.match(page.text, /Demander à devenir responsable/)
    // People of a collectif stay among themselves until V1.1 (ADR 0021).
    assert.doesNotMatch(page.text, /Rita/)

    const rita = app.client()
    await signIn(app, rita, 'rita@example.org')
    const inside = await rita.get(routes.collectifs.people.href({ slug: collectif.slug }))
    assert.match(inside.text, /<a href="\/personnes\/[^"]+">Rita<\/a>/)
  })

  it('records one pending request and notifies the admins', async () => {
    const app = createTestApp(db, { adminEmails: ['boss@example.org'] })
    const client = app.client()
    await signIn(app, client, 'max@example.org')
    const url = routes.collectifs.requestResponsibility.href({ slug: collectif.slug })

    await client.post(url)
    assert.equal((await findResponsible(db, member.id, collectif.id))?.status, 'pending')
    assert.deepEqual(app.mailer.outbox.at(-1)?.to, ['boss@example.org'])
    const sent = app.mailer.outbox.length

    // A second request while the first is open changes nothing.
    await client.post(url)
    assert.equal(app.mailer.outbox.length, sent)
    const page = await client.get(routes.collectifs.show.href({ slug: collectif.slug }))
    assert.match(page.text, /déjà une demande en cours/)
    assert.match(page.text, /en cours d’examen/)
  })

  it('lets a person whose request was rejected ask again', async () => {
    await setResponsible(db, { userId: member.id, collectifId: collectif.id, status: 'rejected' })
    const app = createTestApp(db)
    const client = app.client()
    await signIn(app, client, 'max@example.org')

    await client.post(routes.collectifs.requestResponsibility.href({ slug: collectif.slug }))
    assert.equal((await findResponsible(db, member.id, collectif.id))?.status, 'pending')
  })

  it('refuses the request to someone already responsible (403)', async () => {
    const app = createTestApp(db)
    const client = app.client()
    await signIn(app, client, 'rita@example.org')

    const response = await client.post(
      routes.collectifs.requestResponsibility.href({ slug: collectif.slug }),
    )
    assert.equal(response.status, 403)
  })

  it('answers 404 for an unknown collectif', async () => {
    const app = createTestApp(db)
    const client = app.client()
    await signIn(app, client, 'max@example.org')

    assert.equal((await client.get(routes.collectifs.show.href({ slug: 'nope' }))).status, 404)
  })
})
