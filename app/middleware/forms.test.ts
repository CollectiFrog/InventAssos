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

  it('refuses from Content-Length alone, without reading the body', async () => {
    // The body is tiny: only the declared length can make this refusal.
    const response = await lou.postRaw(profile, 'name=x', {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': String(300 * 1024),
    })
    assert.equal(response.status, 413)
  })

  it('refuses while reading: a field over 64 KiB, or 256 KiB in all', async () => {
    const oneField = new FormData()
    oneField.set('name', 'x'.repeat(70 * 1024))
    assert.equal((await lou.postForm(profile, oneField)).status, 413)
    const fiveFields = new FormData()
    for (let index = 0; index < 5; index++) fiveFields.set(`champ-${index}`, 'x'.repeat(60 * 1024))
    assert.equal((await lou.postForm(profile, fiveFields)).status, 413)
  })

  it('refuses more than 400 fields', async () => {
    const body = new FormData()
    for (let index = 0; index < 401; index++) body.set(`champ-${index}`, 'x')
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

  it('answers 400 to invalid UTF-8 in a field', async () => {
    const head = new TextEncoder().encode(
      '--x\r\nContent-Disposition: form-data; name="name"\r\n\r\n',
    )
    const tail = new TextEncoder().encode('\r\n--x--\r\n')
    const body = new Uint8Array([...head, 0xff, 0xfe, ...tail])
    const response = await lou.postRaw(profile, body, {
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
