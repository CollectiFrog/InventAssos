import * as assert from 'remix/assert'
import type { Database } from 'remix/data-table'
import { after, before, beforeEach, describe, it } from 'remix/test'

import { createTestApp } from '../../../../test/app.ts'
import { signIn } from '../../../../test/auth.ts'
import { openTestDatabase, resetDatabase } from '../../../../test/database.ts'
import { createUser, findUserByEmail, setUserStatus } from '../../../data/users.ts'
import { routes } from '../../../routes.ts'
import { withReturnPath } from '../../return-path.ts'

const profileUrl = routes.account.profile.index.href()

describe('profile (US-0.2.6)', () => {
  let db: Database

  before(async () => {
    db = await openTestDatabase()
  })
  beforeEach(async () => {
    await resetDatabase(db)
    const user = await createUser(db, { name: 'Camille', email: 'camille@example.org' })
    await setUserStatus(db, user.id, 'active')
  })
  after(async () => {
    await db.close()
  })

  it('shows the form with the phone visibility notice', async () => {
    const app = createTestApp(db)
    const client = app.client()
    await signIn(app, client, 'camille@example.org')

    const page = await client.get(profileUrl)
    assert.equal(page.status, 200)
    assert.match(page.text, /value="Camille"/)
    assert.match(page.text, /Visible par les personnes de vos collectifs/)
  })

  it('saves name and phone, and clears the phone when left blank', async () => {
    const app = createTestApp(db)
    const client = app.client()
    await signIn(app, client, 'camille@example.org')

    const response = await client.post(routes.account.profile.action.href(), {
      name: 'Camille Martin',
      phone: '+33 6 12 34 56 78',
    })
    assert.equal(response.location, profileUrl)
    const user = await findUserByEmail(db, 'camille@example.org')
    assert.equal(user?.name, 'Camille Martin')
    assert.equal(user?.phone, '+33 6 12 34 56 78')
    assert.match((await client.get(profileUrl)).text, /Profil enregistré/)

    await client.post(routes.account.profile.action.href(), { name: 'Camille Martin', phone: ' ' })
    assert.equal((await findUserByEmail(db, 'camille@example.org'))?.phone, null)
  })

  it('shows errors and keeps the values on invalid input', async () => {
    const app = createTestApp(db)
    const client = app.client()
    await signIn(app, client, 'camille@example.org')

    const response = await client.post(routes.account.profile.action.href(), {
      name: '',
      phone: 'call me',
    })
    assert.equal(response.status, 400)
    assert.match(response.text, /Ce champ est obligatoire/)
    assert.match(response.text, /Numéro de téléphone invalide/)
    assert.match(response.text, /value="call me"/)
    assert.equal((await findUserByEmail(db, 'camille@example.org'))?.name, 'Camille')
  })

  it('ignores a user ID slipped into the form: only the own account changes', async () => {
    const other = await createUser(db, { name: 'Other', email: 'other@example.org' })
    await setUserStatus(db, other.id, 'active')
    const app = createTestApp(db)
    const client = app.client()
    await signIn(app, client, 'camille@example.org')

    await client.post(routes.account.profile.action.href(), { name: 'Hacked', id: other.id })
    assert.equal((await findUserByEmail(db, 'other@example.org'))?.name, 'Other')
  })

  it('sends a visitor to sign-in', async () => {
    const response = await createTestApp(db).client().get(profileUrl)
    assert.equal(response.location, withReturnPath(routes.signIn.form.index.href(), profileUrl))
  })
})
