import * as assert from 'remix/assert'
import { type Database, sql } from 'remix/data-table'
import { after, before, beforeEach, describe, it } from 'remix/test'

import { openTestDatabase, resetDatabase } from '../../test/database.ts'
import {
  createPostgresSessionStorage,
  deleteExpiredSessions,
  deleteUserSessions,
} from './sessions.ts'
import { createUser } from './users.ts'

describe('PostgreSQL session storage', () => {
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

  it('does not store a session that was never changed', async () => {
    const storage = createPostgresSessionStorage(db)
    const session = await storage.read(null)

    assert.equal(await storage.save(session), null)
  })

  it('stores values and reads them back by ID', async () => {
    const storage = createPostgresSessionStorage(db)
    const alice = await createUser(db, { name: 'Alice', email: 'alice@example.org' })
    const session = await storage.read(null)
    session.set('userId', alice.id)
    session.set('answer', 42)
    const cookie = await storage.save(session)

    const again = await storage.read(cookie)
    assert.equal(again.get('answer'), 42)
    again.set('answer', 43)
    await storage.save(again)
    assert.equal((await storage.read(cookie)).get('answer'), 43)
  })

  it('forgets a destroyed session', async () => {
    const storage = createPostgresSessionStorage(db)
    const alice = await createUser(db, { name: 'Alice', email: 'alice@example.org' })
    const session = await storage.read(null)
    session.set('userId', alice.id)
    session.set('answer', 42)
    const cookie = await storage.save(session)

    const loaded = await storage.read(cookie)
    loaded.destroy()
    assert.equal(await storage.save(loaded), '')
    assert.equal((await storage.read(cookie)).get('answer'), undefined)
  })

  it('keeps a visitor session in the cookie: no row until someone signs in', async () => {
    const storage = createPostgresSessionStorage(db)
    const session = await storage.read(null)
    session.set('_csrf', 'token')
    const cookie = await storage.save(session)

    assert.equal((await storage.read(cookie)).get('_csrf'), 'token')
    const rows = await db.exec(sql`select count(*)::int as n from sessions`)
    assert.equal(rows.rows?.[0]?.n, 0)
  })

  it('stores a signed-in session as a row, and never trusts a user ID found in a cookie', async () => {
    const storage = createPostgresSessionStorage(db)
    const alice = await createUser(db, { name: 'Alice', email: 'alice@example.org' })
    const session = await storage.read(null)
    session.set('userId', alice.id)
    const cookie = await storage.save(session)

    assert.equal(cookie, session.id)
    assert.equal((await storage.read(cookie)).get('userId'), alice.id)
    const forged = JSON.stringify({ i: 'x', d: [{ userId: alice.id }, {}] })
    assert.equal((await storage.read(forged)).get('userId'), undefined)
  })

  it('ignores and purges expired sessions', async () => {
    const storage = createPostgresSessionStorage(db)
    const alice = await createUser(db, { name: 'Alice', email: 'alice@example.org' })
    const session = await storage.read(null)
    session.set('userId', alice.id)
    session.set('answer', 42)
    const cookie = await storage.save(session)
    await db.exec(sql`update sessions set expires_at = now() - interval '1 second'`)

    assert.equal((await storage.read(cookie)).get('answer'), undefined)
    await deleteExpiredSessions(db)
    const rows = await db.exec(sql`select count(*)::int as n from sessions`)
    assert.equal(rows.rows?.[0]?.n, 0)
  })

  it('closes every session of one user only', async () => {
    const storage = createPostgresSessionStorage(db)
    const alice = await createUser(db, { name: 'Alice', email: 'alice@example.org' })
    const bob = await createUser(db, { name: 'Bob', email: 'bob@example.org' })
    const cookies: Record<string, string | null> = {}
    for (const [name, id] of [
      ['alice', alice.id],
      ['bob', bob.id],
    ] as const) {
      const session = await storage.read(null)
      session.set('userId', id)
      cookies[name] = await storage.save(session)
    }

    await deleteUserSessions(db, alice.id)

    assert.equal((await storage.read(cookies.alice ?? null)).get('userId'), undefined)
    assert.equal((await storage.read(cookies.bob ?? null)).get('userId'), bob.id)
  })
})
