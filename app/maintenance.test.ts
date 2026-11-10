import * as assert from 'remix/assert'
import { type Database, sql } from 'remix/data-table'
import { after, before, beforeEach, describe, it } from 'remix/test'

import { openTestDatabase, resetDatabase } from '../test/database.ts'
import { createPostgresSessionStorage } from './data/sessions.ts'
import { createSignInToken } from './data/sign-in-tokens.ts'
import { createUser } from './data/users.ts'
import { purgeExpiredData, startPeriodicPurge } from './maintenance.ts'

describe('purge of expired rows (review F5)', () => {
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

  async function seedOneLiveAndOneExpiredOfEach() {
    const user = await createUser(db, { name: 'Alice', email: 'alice@example.org' })
    const storage = createPostgresSessionStorage(db)
    for (let i = 0; i < 2; i++) {
      const session = await storage.read(null)
      session.set('userId', user.id)
      await storage.save(session)
      await createSignInToken(db, user.id)
    }
    await db.exec(sql`
      update sessions set expires_at = now() - interval '1 second'
      where id = (select id from sessions limit 1)
    `)
    await db.exec(sql`
      update sign_in_tokens set expires_at = now() - interval '1 second'
      where token_hash = (select token_hash from sign_in_tokens limit 1)
    `)
  }

  async function counts() {
    const result = await db.exec(sql`
      select (select count(*)::int from sessions) as sessions,
             (select count(*)::int from sign_in_tokens) as tokens
    `)
    return result.rows?.[0]
  }

  it('deletes expired sessions and stale sign-in tokens, keeps live ones', async () => {
    await seedOneLiveAndOneExpiredOfEach()
    await purgeExpiredData(db)
    assert.deepEqual(await counts(), { sessions: 1, tokens: 1 })
  })

  it('runs again on a timer while the server runs', async () => {
    await seedOneLiveAndOneExpiredOfEach()
    const stop = startPeriodicPurge(db, 10)
    try {
      for (let i = 0; i < 100 && (await counts())?.sessions !== 1; i++) {
        await new Promise((resolve) => setTimeout(resolve, 10))
      }
    } finally {
      stop()
    }
    assert.deepEqual(await counts(), { sessions: 1, tokens: 1 })
  })
})
