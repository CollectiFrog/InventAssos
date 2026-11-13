import * as assert from 'remix/assert'
import type { Database } from 'remix/data-table'
import { after, before, beforeEach, describe, it } from 'remix/test'

import { createTestApp } from '../../../test/app.ts'
import { signIn } from '../../../test/auth.ts'
import { openTestDatabase, resetDatabase } from '../../../test/database.ts'
import { createUser, findUserByEmail, setUserStatus } from '../../data/users.ts'
import { routes } from '../../routes.ts'

// Only platform admins get the Administration section of Mon compte (US-0.10.9).
const adminBadge = /<a href="\/admin" class="button">Ouvrir l’administration<\/a>/

describe('platform admins from PLATFORM_ADMIN_EMAILS (US-0.2.5)', () => {
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

  it('creates a listed admin at their first sign-in, active without approval', async () => {
    const app = createTestApp(db, { adminEmails: ['Boss@Example.org'] })
    const client = app.client()

    await signIn(app, client, 'boss@example.org')

    const user = await findUserByEmail(db, 'boss@example.org')
    assert.equal(user?.status, 'active')
    assert.equal(user?.is_platform_admin, true)
    assert.equal(user?.name, 'boss')
    const account = await client.get(routes.account.profile.index.href())
    assert.equal(account.status, 200)
    assert.match(account.text, adminBadge)
  })

  it('activates a listed e-mail that had signed up and was still pending', async () => {
    await createUser(db, { name: 'Boss', email: 'boss@example.org' })
    const app = createTestApp(db, { adminEmails: ['boss@example.org'] })

    await signIn(app, app.client(), 'boss@example.org')

    const user = await findUserByEmail(db, 'boss@example.org')
    assert.equal(user?.status, 'active')
    assert.equal(user?.is_platform_admin, true)
  })

  it('never gives admin rights to an e-mail that is not listed', async () => {
    const user = await createUser(db, { name: 'Pat', email: 'pat@example.org' })
    await setUserStatus(db, user.id, 'active')
    const app = createTestApp(db, { adminEmails: ['boss@example.org'] })
    const client = app.client()

    await signIn(app, client, 'pat@example.org')

    assert.equal((await findUserByEmail(db, 'pat@example.org'))?.is_platform_admin, false)
    const account = await client.get(routes.account.profile.index.href())
    assert.doesNotMatch(account.text, adminBadge)
  })

  it('drops admin rights as soon as the e-mail leaves the list', async () => {
    const listed = createTestApp(db, { adminEmails: ['boss@example.org'] })
    const client = listed.client()
    await signIn(listed, client, 'boss@example.org')

    // Same browser, new configuration: rights are read from the variable on every request.
    const unlisted = createTestApp(db, { adminEmails: [] })
    const account = await unlisted.router.fetch(
      new Request(new URL(routes.account.profile.index.href(), 'http://inventassos.test'), {
        headers: { Cookie: client.cookieHeader() },
      }),
    )
    assert.doesNotMatch(await account.text(), adminBadge)

    await signIn(unlisted, unlisted.client(), 'boss@example.org')
    assert.equal((await findUserByEmail(db, 'boss@example.org'))?.is_platform_admin, false)
  })

  it('does not create an account for an unknown e-mail that is not listed', async () => {
    const app = createTestApp(db, { adminEmails: ['boss@example.org'] })
    await app.client().post(routes.signIn.form.action.href(), { email: 'stranger@example.org' })

    assert.equal(await findUserByEmail(db, 'stranger@example.org'), null)
  })
})
