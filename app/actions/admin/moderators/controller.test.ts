import * as assert from 'remix/assert'
import type { Database } from 'remix/data-table'
import { after, before, beforeEach, describe, it } from 'remix/test'

import { createTestApp, type TestApp, type TestClient } from '../../../../test/app.ts'
import { signIn } from '../../../../test/auth.ts'
import { createActiveCollectif } from '../../../../test/collectifs.ts'
import { openTestDatabase, resetDatabase } from '../../../../test/database.ts'
import { createTestItem } from '../../../../test/items.ts'
import { createTestLocation } from '../../../../test/locations.ts'
import { createActiveUser } from '../../../../test/users.ts'
import { listEntityHistory } from '../../../data/audit-log.ts'
import { findItemById } from '../../../data/items.ts'
import { setResponsible } from '../../../data/members.ts'
import type { Item, User } from '../../../data/tables.ts'
import { createUser, findUserById, setUserRole, setUserStatus } from '../../../data/users.ts'
import { routes } from '../../../routes.ts'

describe('moderators (US-0.8.1, US-0.8.2)', () => {
  let db: Database
  let app: TestApp
  let boss: TestClient
  let mona: User
  let rita: User
  let val: User
  let item: Item

  before(async () => {
    db = await openTestDatabase()
  })
  beforeEach(async () => {
    await resetDatabase(db)
    mona = await createActiveUser(db, 'Mona', 'mona@example.org')
    rita = await createActiveUser(db, 'Rita', 'rita@example.org')
    val = await createActiveUser(db, 'Val', 'val@example.org')
    const frog = await createActiveCollectif(db, "Collecti'FROG", rita.id)
    const local = await createTestLocation(db, { collectifId: frog.id }, 'Local')
    item = await createTestItem(db, {
      locationId: local.id,
      owner: { collectifId: frog.id },
      createdBy: rita.id,
      name: 'Enceinte douteuse',
    })
    app = createTestApp(db, { adminEmails: ['boss@example.org'] })
    boss = app.client()
    await signIn(app, boss, 'boss@example.org')
  })
  after(async () => {
    await db.close()
  })

  async function signedInMona(): Promise<TestClient> {
    await setUserRole(db, mona.id, 'moderator')
    const client = app.client()
    await signIn(app, client, 'mona@example.org')
    return client
  }

  it('names a moderator by e-mail, lists them and logs it, IDs only', async () => {
    const response = await boss.post(routes.admin.moderators.name.href(), {
      email: 'MONA@example.org',
    })
    assert.equal(response.location, routes.admin.moderators.index.href())
    assert.equal((await findUserById(db, mona.id))?.role, 'moderator')
    const page = await boss.get(routes.admin.moderators.index.href())
    assert.match(page.text, /Mona est maintenant modérateur/)
    assert.match(page.text, new RegExp(routes.admin.moderators.remove.href({ userId: mona.id })))
    const [entry] = await listEntityHistory(db, 'user', mona.id)
    assert.equal(entry?.action, 'user.moderator_named')
    assert.doesNotMatch(JSON.stringify(entry), /mona@|Mona/)
  })

  it('refuses an unknown, pending, admin or already named account, with the reason', async () => {
    await createUser(db, { name: 'Pat', email: 'pat@example.org' })
    await setUserRole(db, mona.id, 'moderator')
    const cases: [string, RegExp][] = [
      ['', /Ce champ est obligatoire/],
      ['nobody@example.org', /Aucun compte validé n’a cette adresse/],
      ['pat@example.org', /Aucun compte validé n’a cette adresse/],
      ['boss@example.org', /est administrateur/],
      ['mona@example.org', /déjà modérateur/],
    ]
    for (const [email, message] of cases) {
      const response = await boss.post(routes.admin.moderators.name.href(), { email })
      assert.equal(response.status, 400, email)
      assert.match(response.text, message)
    }
  })

  it('removes a moderator, who loses Administration at the next request', async () => {
    const monaClient = await signedInMona()
    assert.equal((await monaClient.get(routes.admin.index.href())).status, 200)
    await boss.post(routes.admin.moderators.remove.href({ userId: mona.id }))
    assert.equal((await findUserById(db, mona.id))?.role, 'member')
    assert.equal((await monaClient.get(routes.admin.index.href())).status, 403)
    const [entry] = await listEntityHistory(db, 'user', mona.id)
    assert.equal(entry?.action, 'user.moderator_removed')
  })

  it('gives a moderator Administration without the Modérateurs tab', async () => {
    const monaClient = await signedInMona()
    const home = (await monaClient.get(routes.home.href())).text
    assert.match(home, /href="\/admin"/)
    const queue = (await monaClient.get(routes.admin.index.href())).text
    assert.doesNotMatch(queue, /Modérateurs/)
    assert.equal((await monaClient.get(routes.admin.moderators.index.href())).status, 403)
  })

  it('shows a moderator the buttons they may use on each account, and labels the others', async () => {
    const max = await createActiveUser(db, 'Max', 'max@example.org')
    await setUserRole(db, max.id, 'moderator')
    const monaClient = await signedInMona()
    const page = (await monaClient.get(routes.admin.accounts.href())).text
    assert.match(page, new RegExp(routes.admin.disableAccount.href({ userId: val.id })))
    assert.doesNotMatch(page, new RegExp(routes.admin.disableAccount.href({ userId: max.id })))
    assert.match(
      page,
      /<strong>Max<\/strong> · max@example.org<\/span><span class="status">modérateur/,
    )
    const response = await monaClient.post(routes.admin.disableAccount.href({ userId: max.id }))
    assert.equal(response.status, 403)
  })

  it('e-mails the moderators about new requests, with the admins', async () => {
    await setUserRole(db, mona.id, 'moderator')
    const visitor = app.client()
    await visitor.post(routes.signUp.form.action.href(), {
      name: 'Nina',
      email: 'nina@example.org',
    })
    const notice = app.mailer.outbox.find((mail) => mail.subject === 'Nouvelle demande de compte')
    assert.deepEqual(notice?.to, ['boss@example.org', 'mona@example.org'])
  })

  it('archives an abusive item and e-mails its owner the message, never storing it', async () => {
    const monaClient = await signedInMona()
    const page = (await monaClient.get(routes.items.show.href({ itemId: item.id }))).text
    assert.match(page, /Retirer \(modération\)/)
    assert.doesNotMatch(page, new RegExp(routes.items.edit.index.href({ itemId: item.id })))
    const form = (await monaClient.get(routes.items.archive.index.href({ itemId: item.id }))).text
    assert.match(form, /<option value="moderated" selected>Retiré par la modération<\/option>/)
    assert.doesNotMatch(form, /value="sold"/)

    const response = await monaClient.post(routes.items.archive.action.href({ itemId: item.id }), {
      reason: 'moderated',
      message: 'Annonce commerciale, hors sujet.',
    })
    assert.equal(response.location, routes.items.show.href({ itemId: item.id }))
    assert.equal((await findItemById(db, item.id))?.archive_reason, 'moderated')
    const mail = app.mailer.outbox.findLast((m) => /retiré par la modération/.test(m.subject))
    assert.equal(mail?.to, 'rita@example.org')
    assert.match(mail?.text ?? '', /Annonce commerciale, hors sujet\./)
    const [entry] = await listEntityHistory(db, 'item', item.id)
    assert.doesNotMatch(JSON.stringify(entry), /Annonce commerciale/)
    // The moderator still reaches the archived item, to check what was done.
    const archived = await monaClient.get(routes.items.show.href({ itemId: item.id }))
    assert.match(archived.text, /retiré par la modération/)
  })

  it('e-mails each responsible apart, so none sees the others’ address', async () => {
    const cora = await createActiveUser(db, 'Cora', 'cora@example.org')
    await setResponsible(db, {
      userId: cora.id,
      collectifId: item.owner_collectif_id ?? '',
      status: 'active',
    })
    const monaClient = await signedInMona()
    await monaClient.post(routes.items.archive.action.href({ itemId: item.id }), {
      reason: 'moderated',
      message: 'Hors sujet.',
    })
    const sent = app.mailer.outbox.filter((m) => /retiré par la modération/.test(m.subject))
    assert.deepEqual(sent.map((m) => m.to).sort(), ['cora@example.org', 'rita@example.org'])
  })

  it('asks a moderator for the message, and refuses an owner reason', async () => {
    const monaClient = await signedInMona()
    const url = routes.items.archive.action.href({ itemId: item.id })
    const empty = await monaClient.post(url, { reason: 'moderated', message: ' ' })
    assert.equal(empty.status, 400)
    assert.match(empty.text, /Expliquez au propriétaire/)
    assert.equal((await monaClient.post(url, { reason: 'sold' })).status, 403)
    assert.equal((await findItemById(db, item.id))?.archived_at, null)
  })

  it('gives a disabled moderator nothing', async () => {
    const monaClient = await signedInMona()
    await setUserStatus(db, mona.id, 'disabled')
    const response = await monaClient.get(routes.admin.index.href())
    assert.notEqual(response.status, 200)
  })
})
