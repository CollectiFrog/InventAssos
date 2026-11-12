import * as assert from 'remix/assert'
import { type Database, sql } from 'remix/data-table'
import { after, before, beforeEach, describe, it } from 'remix/test'

import { createTestApp, type TestApp, type TestClient } from '../../test/app.ts'
import { signIn } from '../../test/auth.ts'
import { openTestDatabase, resetDatabase } from '../../test/database.ts'
import { createActiveUser } from '../../test/users.ts'
import { routes } from '../routes.ts'

describe('bounded form posts (security review of ADR 0026)', () => {
  let db: Database
  let app: TestApp
  let lou: TestClient

  before(async () => {
    db = await openTestDatabase()
  })
  beforeEach(async () => {
    await resetDatabase(db)
    await createActiveUser(db, 'Lou', 'lou@example.org')
    app = createTestApp(db)
    lou = app.client()
    await signIn(app, lou, 'lou@example.org')
  })
  after(async () => {
    await db.close()
  })

  const profile = routes.account.profile.action.href()

  it('refuses a file where none is expected, and changes nothing', async () => {
    const body = new FormData()
    body.set('name', 'Pirate')
    body.set('phone', '')
    body.set('pièce', new File(['x'], 'x.csv', { type: 'text/csv' }))
    const response = await lou.postForm(profile, body)
    assert.equal(response.status, 413)
    const n = await db.exec(sql`select count(*)::int as n from users where name = 'Pirate'`)
    assert.equal(n.rows?.[0]?.n, 0)
  })

  it('refuses a body too large, from its Content-Length or while reading it', async () => {
    const big = 'x'.repeat(300 * 1024)
    const declared = await lou.postRaw(profile, `name=${big}`, {
      'Content-Type': 'application/x-www-form-urlencoded',
    })
    assert.equal(declared.status, 413)
    const body = new FormData()
    body.set('description', big)
    assert.equal((await lou.postForm(profile, body)).status, 413)
  })

  it('refuses before reading for a visitor too, CSRF or not', async () => {
    const visitor = app.client()
    const body = new FormData()
    body.set('file', new File(['x'.repeat(3 * 1024 * 1024)], 'big.csv'))
    const response = await visitor.postForm(routes.signIn.form.action.href(), body, {
      csrf: false,
    })
    assert.equal(response.status, 413)
  })

  it('answers 400, not a server error, to a malformed multipart body', async () => {
    const response = await lou.postRaw(profile, '--x\r\nbroken', {
      'Content-Type': 'multipart/form-data; boundary=x',
    })
    assert.equal(response.status, 400)
  })

  it('still accepts a form with hundreds of fields', async () => {
    const body = new FormData()
    body.set('name', 'Lou Renommée')
    body.set('phone', '')
    for (let index = 0; index < 300; index++) body.set(`champ-${index}`, 'x')
    const response = await lou.postForm(profile, body)
    assert.equal(response.status, 303)
    const n = await db.exec(sql`select count(*)::int as n from users where name = 'Lou Renommée'`)
    assert.equal(n.rows?.[0]?.n, 1)
  })
})
