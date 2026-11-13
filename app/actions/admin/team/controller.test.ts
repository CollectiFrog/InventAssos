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
import {
  createUser,
  findUserByEmail,
  findUserById,
  setUserRole,
  setUserStatus,
} from '../../../data/users.ts'
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
    const response = await boss.post(routes.admin.team.name.href(), {
      email: 'MONA@example.org',
      role: 'moderator',
    })
    assert.equal(response.location, routes.admin.team.index.href())
    assert.equal((await findUserById(db, mona.id))?.role, 'moderator')
    const page = await boss.get(routes.admin.team.index.href())
    assert.match(page.text, /Mona est maintenant modérateur/)
    assert.match(page.text, new RegExp(routes.admin.team.remove.href({ userId: mona.id })))
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
      ['boss@example.org', /administrateur par la configuration/],
      ['mona@example.org', /déjà modérateur/],
    ]
    for (const [email, message] of cases) {
      const response = await boss.post(routes.admin.team.name.href(), { email, role: 'moderator' })
      assert.equal(response.status, 400, email)
      assert.match(response.text, message)
    }
  })

  it('removes a moderator, who loses Administration at the next request', async () => {
    const monaClient = await signedInMona()
    assert.equal((await monaClient.get(routes.admin.index.href())).status, 200)
    await boss.post(routes.admin.team.remove.href({ userId: mona.id }))
    assert.equal((await findUserById(db, mona.id))?.role, 'member')
    assert.equal((await monaClient.get(routes.admin.index.href())).status, 403)
    const [entry] = await listEntityHistory(db, 'user', mona.id)
    assert.equal(entry?.action, 'user.moderator_removed')
  })

  it('gives a moderator Administration without the Équipe tab', async () => {
    const monaClient = await signedInMona()
    const account = (await monaClient.get(routes.account.profile.index.href())).text
    assert.match(account, /<a href="\/admin" class="button">Ouvrir l’administration<\/a>/)
    const queue = (await monaClient.get(routes.admin.index.href())).text
    assert.doesNotMatch(queue, /Équipe/)
    assert.equal((await monaClient.get(routes.admin.team.index.href())).status, 403)
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

  it('e-mails each admin and moderator apart about new requests', async () => {
    await setUserRole(db, mona.id, 'moderator')
    const visitor = app.client()
    await visitor.post(routes.signUp.form.action.href(), {
      name: 'Nina',
      email: 'nina@example.org',
    })
    const notices = app.mailer.outbox.filter((m) => m.subject === 'Nouvelle demande de compte')
    assert.deepEqual(
      notices.map((m) => m.to),
      [['boss@example.org'], ['mona@example.org']],
    )
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

describe('admins named in the app (US-0.10.7)', () => {
  let db: Database
  let app: TestApp
  let boss: TestClient
  let nora: User
  let val: User

  before(async () => {
    db = await openTestDatabase()
  })
  beforeEach(async () => {
    await resetDatabase(db)
    nora = await createActiveUser(db, 'Nora', 'nora@example.org')
    val = await createActiveUser(db, 'Val', 'val@example.org')
    app = createTestApp(db, { adminEmails: ['boss@example.org'] })
    boss = app.client()
    await signIn(app, boss, 'boss@example.org')
  })
  after(async () => {
    await db.close()
  })

  async function signedInNora(): Promise<TestClient> {
    await setUserRole(db, nora.id, 'admin')
    const client = app.client()
    await signIn(app, client, 'nora@example.org')
    return client
  }

  it('names an admin by e-mail and logs it, IDs only', async () => {
    const response = await boss.post(routes.admin.team.name.href(), {
      email: 'nora@example.org',
      role: 'admin',
    })
    assert.equal(response.location, routes.admin.team.index.href())
    assert.equal((await findUserById(db, nora.id))?.role, 'admin')
    const page = (await boss.get(routes.admin.team.index.href())).text
    assert.match(page, /Nora est maintenant administrateur/)
    assert.match(page, new RegExp(routes.admin.team.remove.href({ userId: nora.id })))
    const [entry] = await listEntityHistory(db, 'user', nora.id)
    assert.equal(entry?.action, 'user.admin_named')
    assert.doesNotMatch(JSON.stringify(entry), /nora@|Nora/)
  })

  it('gives a named admin every admin right, the Équipe tab included', async () => {
    const noraClient = await signedInNora()
    const team = await noraClient.get(routes.admin.team.index.href())
    assert.equal(team.status, 200)
    assert.match(team.text, /href="\/admin\/equipe"/)
    const response = await noraClient.post(routes.admin.team.name.href(), {
      email: 'val@example.org',
      role: 'admin',
    })
    assert.equal(response.status, 303)
    assert.equal((await findUserById(db, val.id))?.role, 'admin')
  })

  it('turns a moderator into an admin, logging both changes', async () => {
    await setUserRole(db, val.id, 'moderator')
    await boss.post(routes.admin.team.name.href(), { email: 'val@example.org', role: 'admin' })
    assert.equal((await findUserById(db, val.id))?.role, 'admin')
    const actions = (await listEntityHistory(db, 'user', val.id)).map((e) => e.action)
    assert.deepEqual(actions, ['user.moderator_removed', 'user.admin_named'])
  })

  it('lets a named admin remove another named admin, who loses Administration at once', async () => {
    const noraClient = await signedInNora()
    await setUserRole(db, val.id, 'admin')
    const valClient = app.client()
    await signIn(app, valClient, 'val@example.org')
    assert.equal((await valClient.get(routes.admin.index.href())).status, 200)

    await noraClient.post(routes.admin.team.remove.href({ userId: val.id }))
    assert.equal((await findUserById(db, val.id))?.role, 'member')
    assert.equal((await valClient.get(routes.admin.index.href())).status, 403)
    const actions = (await listEntityHistory(db, 'user', val.id)).map((e) => e.action)
    assert.deepEqual(actions, ['user.admin_removed'])
  })

  it('never lets an admin change their own role', async () => {
    const noraClient = await signedInNora()
    const page = (await noraClient.get(routes.admin.team.index.href())).text
    assert.doesNotMatch(page, new RegExp(routes.admin.team.remove.href({ userId: nora.id })))
    const removed = await noraClient.post(routes.admin.team.remove.href({ userId: nora.id }))
    assert.equal(removed.status, 403)
    const renamed = await noraClient.post(routes.admin.team.name.href(), {
      email: 'nora@example.org',
      role: 'moderator',
    })
    assert.equal(renamed.status, 400)
    assert.match(renamed.text, /Vous ne pouvez pas changer votre rôle/)
    assert.equal((await findUserById(db, nora.id))?.role, 'admin')
  })

  it('shows the admins from the configuration without « Retirer », and never removes them', async () => {
    const noraClient = await signedInNora()
    const bossUser = await findUserByEmail(db, 'boss@example.org')
    const page = (await noraClient.get(routes.admin.team.index.href())).text
    assert.match(page, /boss@example.org<span class="status"> · par la configuration/)
    const removeBoss = routes.admin.team.remove.href({ userId: bossUser?.id ?? '' })
    assert.doesNotMatch(page, new RegExp(removeBoss))
    // Even with a role stored on the account, a listed admin stays out of reach.
    await setUserRole(db, bossUser?.id ?? '', 'admin')
    assert.equal((await noraClient.post(removeBoss)).status, 403)
    assert.equal((await findUserById(db, bossUser?.id ?? ''))?.role, 'admin')
  })

  it('refuses an unknown role', async () => {
    const response = await boss.post(routes.admin.team.name.href(), {
      email: 'val@example.org',
      role: 'superadmin',
    })
    assert.equal(response.status, 400)
    assert.match(response.text, /Choisissez un rôle/)
    assert.equal((await findUserById(db, val.id))?.role, 'member')
  })

  it('labels a named admin « administrateur » and keeps moderators off their account', async () => {
    await setUserRole(db, nora.id, 'admin')
    const mona = await createActiveUser(db, 'Mona', 'mona@example.org')
    await setUserRole(db, mona.id, 'moderator')
    const monaClient = app.client()
    await signIn(app, monaClient, 'mona@example.org')
    const accounts = (await monaClient.get(routes.admin.accounts.href())).text
    assert.match(
      accounts,
      /<strong>Nora<\/strong> · nora@example.org<\/span><span class="status">administrateur/,
    )
    assert.doesNotMatch(accounts, new RegExp(routes.admin.disableAccount.href({ userId: nora.id })))
    const refused = await monaClient.post(routes.admin.disableAccount.href({ userId: nora.id }))
    assert.equal(refused.status, 403)
    // An admin may disable a named admin: only listed admins are protected from the app.
    await boss.post(routes.admin.disableAccount.href({ userId: nora.id }))
    assert.equal((await findUserById(db, nora.id))?.status, 'disabled')
  })

  it('e-mails named admins about new requests too', async () => {
    await setUserRole(db, nora.id, 'admin')
    await app.client().post(routes.signUp.form.action.href(), {
      name: 'Pat',
      email: 'pat@example.org',
    })
    const notices = app.mailer.outbox.filter((m) => m.subject === 'Nouvelle demande de compte')
    assert.deepEqual(
      notices.map((m) => m.to),
      [['boss@example.org'], ['nora@example.org']],
    )
  })

  it('sends the old Modérateurs address to Équipe', async () => {
    const response = await boss.get(routes.admin.oldModerators.href())
    assert.equal(response.status, 301)
    assert.equal(response.location, routes.admin.team.index.href())
  })
})
