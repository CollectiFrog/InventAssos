import * as assert from 'remix/assert'
import { type Database, sql } from 'remix/data-table'
import { after, before, beforeEach, describe, it } from 'remix/test'

import { createTestApp, type TestApp, type TestClient } from '../../../../test/app.ts'
import { signIn } from '../../../../test/auth.ts'
import { createActiveCollectif } from '../../../../test/collectifs.ts'
import { openTestDatabase, resetDatabase } from '../../../../test/database.ts'
import { createTestItem } from '../../../../test/items.ts'
import { createTestLocation } from '../../../../test/locations.ts'
import { createActiveUser } from '../../../../test/users.ts'
import { findMembership, setResponsible } from '../../../data/members.ts'
import type { Collectif, User } from '../../../data/tables.ts'
import { routes } from '../../../routes.ts'

describe('collectif members (US-0.8.3, US-0.8.4, US-0.8.7)', () => {
  let db: Database
  let app: TestApp
  let frog: Collectif
  let rita: User
  let nina: User
  let ninaClient: TestClient
  let ritaClient: TestClient

  before(async () => {
    db = await openTestDatabase()
  })
  beforeEach(async () => {
    await resetDatabase(db)
    rita = await createActiveUser(db, 'Rita', 'rita@example.org')
    const cora = await createActiveUser(db, 'Cora', 'cora@example.org')
    nina = await createActiveUser(db, 'Nina', 'nina@example.org')
    frog = await createActiveCollectif(db, "Collecti'FROG", rita.id)
    await setResponsible(db, { userId: cora.id, collectifId: frog.id, status: 'active' })
    const local = await createTestLocation(db, { collectifId: frog.id }, 'Local du FROG')
    await createTestItem(db, {
      locationId: local.id,
      owner: { collectifId: frog.id },
      createdBy: rita.id,
      name: 'Console du FROG',
    })
    app = createTestApp(db)
    ninaClient = app.client()
    await signIn(app, ninaClient, 'nina@example.org')
    ritaClient = app.client()
    await signIn(app, ritaClient, 'rita@example.org')
  })
  after(async () => {
    await db.close()
  })

  const slug = () => frog.slug
  const join = () => ninaClient.post(routes.collectifs.join.href({ slug: slug() }))
  const membersPage = (client: TestClient) =>
    client.get(routes.collectifs.people.href({ slug: slug() }))

  it('offers an outsider « Demander à rejoindre », and nothing of the inventory', async () => {
    const html = (await ninaClient.get(routes.collectifs.show.href({ slug: slug() }))).text
    assert.match(html, /Demander à rejoindre/)
    assert.doesNotMatch(html, /Console du FROG/)
  })

  it('records the request, logs it and e-mails each responsible apart', async () => {
    const response = await join()
    assert.equal(response.location, routes.collectifs.show.href({ slug: slug() }))
    const row = await findMembership(db, nina.id, frog.id)
    assert.equal(row?.role, 'member')
    assert.equal(row?.status, 'pending')
    const mails = app.mailer.outbox.filter((m) => /Demande pour rejoindre/.test(m.subject))
    assert.deepEqual(mails.map((m) => m.to).sort(), ['cora@example.org', 'rita@example.org'])
    assert.match(mails[0]?.text ?? '', /Nina demande à rejoindre/)
    assert.match(mails[0]?.text ?? '', /\/collectifs\/collecti-frog\/membres/)
    const page = (await ninaClient.get(routes.collectifs.show.href({ slug: slug() }))).text
    assert.match(page, /Votre demande pour rejoindre ce collectif est en cours/)
    assert.doesNotMatch(page, /Console du FROG/)
    const log = await db.exec(
      sql`select action, payload from audit_log where action like 'member.%'`,
    )
    assert.equal(log.rows?.[0]?.action, 'member.requested')
  })

  it('keeps one open request per person and collectif', async () => {
    await join()
    const before = app.mailer.outbox.length
    await join()
    assert.equal(app.mailer.outbox.length, before)
    const page = (await ninaClient.get(routes.collectifs.show.href({ slug: slug() }))).text
    assert.match(page, /déjà une demande en cours/)
  })

  it('shows the requests first in Membres, to its responsibles only', async () => {
    await join()
    const html = (await membersPage(ritaClient)).text
    assert.match(html, /Membres · 1 en attente/)
    assert.ok(html.indexOf('Demandes pour rejoindre · 1') < html.indexOf('id="membres"'))
    assert.match(html, /<strong>Nina<\/strong>/)
    assert.match(
      html,
      new RegExp(routes.collectifs.members.approve.href({ slug: slug(), userId: nina.id })),
    )
  })

  it('accepts a member, who then sees the inventory and the collectif in their sidebar', async () => {
    await join()
    const url = routes.collectifs.members.approve.href({ slug: slug(), userId: nina.id })
    const response = await ritaClient.post(url)
    assert.equal(response.location, routes.collectifs.people.href({ slug: slug() }))
    assert.equal((await findMembership(db, nina.id, frog.id))?.status, 'active')
    const mail = app.mailer.outbox.findLast((m) => m.to === 'nina@example.org')
    assert.match(mail?.subject ?? '', /Bienvenue dans « Collecti'FROG »/)

    const page = (await ninaClient.get(routes.collectifs.show.href({ slug: slug() }))).text
    assert.match(page, /Console du FROG/)
    assert.match(page, /Vous êtes membre/)
    assert.doesNotMatch(page, /Demander à rejoindre/)
    assert.doesNotMatch(page, /Ajouter un lieu/)
    const members = (await membersPage(ninaClient)).text
    assert.match(members, /<td data-label="Rôle">Membre<\/td>/)
    assert.doesNotMatch(members, /Retirer Nina/)
    const search = (await ninaClient.get(routes.inventory.index.href())).text
    assert.match(search, /Console du FROG/)
  })

  it('rejects a request; the person may ask again', async () => {
    await join()
    await ritaClient.post(routes.collectifs.members.reject.href({ slug: slug(), userId: nina.id }))
    assert.equal((await findMembership(db, nina.id, frog.id))?.status, 'rejected')
    const mail = app.mailer.outbox.findLast((m) => m.to === 'nina@example.org')
    assert.match(mail?.text ?? '', /n’a pas été acceptée/)
    await join()
    assert.equal((await findMembership(db, nina.id, frog.id))?.status, 'pending')
  })

  it('removes a member, who loses the inventory at once', async () => {
    await join()
    await ritaClient.post(routes.collectifs.members.approve.href({ slug: slug(), userId: nina.id }))
    const remove = routes.collectifs.members.remove.href({ slug: slug(), userId: nina.id })
    assert.match((await membersPage(ritaClient)).text, /Retirer Nina/)
    await ritaClient.post(remove)
    assert.equal((await findMembership(db, nina.id, frog.id))?.status, 'removed')
    const page = (await ninaClient.get(routes.collectifs.show.href({ slug: slug() }))).text
    assert.doesNotMatch(page, /Console du FROG/)
    const log = await db.exec(sql`select action from audit_log where action like 'member.%'
      order by at`)
    assert.deepEqual(
      (log.rows ?? []).map((row) => row.action),
      ['member.requested', 'member.approved', 'member.removed'],
    )
  })

  it('never removes a responsible through the members form', async () => {
    const remove = routes.collectifs.members.remove.href({ slug: slug(), userId: rita.id })
    const cora = app.client()
    await signIn(app, cora, 'cora@example.org')
    await cora.post(remove)
    assert.equal((await findMembership(db, rita.id, frog.id))?.status, 'active')
  })

  it('refuses decisions from anyone but its responsibles, admins included', async () => {
    await join()
    const approve = routes.collectifs.members.approve.href({ slug: slug(), userId: nina.id })
    await createActiveUser(db, 'Boss', 'boss@example.org')
    const adminApp = createTestApp(db, { adminEmails: ['boss@example.org'] })
    const boss = adminApp.client()
    await signIn(adminApp, boss, 'boss@example.org')
    assert.equal((await boss.post(approve)).status, 403)
    assert.equal((await ninaClient.post(approve)).status, 403)
    assert.equal((await findMembership(db, nina.id, frog.id))?.status, 'pending')
  })

  it('redirects the former Responsables address to Membres', async () => {
    const response = await ritaClient.get(`/collectifs/${slug()}/responsables`)
    assert.equal(response.status, 301)
    assert.equal(response.location, routes.collectifs.people.href({ slug: slug() }))
  })
})
