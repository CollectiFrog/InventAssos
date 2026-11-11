import * as assert from 'remix/assert'
import { type Database, sql } from 'remix/data-table'
import { after, before, beforeEach, describe, it } from 'remix/test'

import { openTestDatabase, resetDatabase } from '../test/database.ts'
import { createPostgresSessionStorage } from './data/sessions.ts'
import { createSignInToken } from './data/sign-in-tokens.ts'
import { createUser } from './data/users.ts'
import {
  purgeExpiredData,
  purgeIntervalMs,
  type Repeat,
  repeatWithTimer,
  startPeriodicPurge,
} from './maintenance.ts'

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

  /** A scheduler the test drives by hand: no real time, so no race (#90). */
  function manualRepeat() {
    const state = {
      intervalMs: 0,
      cancelled: false,
      tick: async () => {},
    }
    const repeat: Repeat = (run, intervalMs) => {
      state.intervalMs = intervalMs
      state.tick = run
      return () => {
        state.cancelled = true
      }
    }
    return { state, repeat }
  }

  it('purges on each tick of the hourly timer while the server runs', async () => {
    const { state, repeat } = manualRepeat()
    const stop = startPeriodicPurge(db, undefined, repeat)
    assert.equal(state.intervalMs, purgeIntervalMs)

    await seedOneLiveAndOneExpiredOfEach()
    await state.tick()
    assert.deepEqual(await counts(), { sessions: 1, tokens: 1 })

    await stop()
    assert.equal(state.cancelled, true)
  })

  it('waits for a running purge when stopped, and never runs two at once', async () => {
    const { state, repeat } = manualRepeat()
    const stop = startPeriodicPurge(db, 10, repeat)
    await seedOneLiveAndOneExpiredOfEach()

    const first = state.tick()
    assert.equal(state.tick(), first)
    await stop()
    assert.deepEqual(await counts(), { sessions: 1, tokens: 1 })
  })
})

describe('repeatWithTimer', () => {
  it('calls the function at each interval until cancelled', (t) => {
    const timers = t.useFakeTimers()
    const run = t.mock.fn(async () => {})
    const cancel = repeatWithTimer(run, 1000)

    timers.advance(999)
    assert.equal(run.mock.calls.length, 0)
    timers.advance(1)
    timers.advance(1000)
    assert.equal(run.mock.calls.length, 2)
    cancel()
    timers.advance(5000)
    assert.equal(run.mock.calls.length, 2)
  })
})
