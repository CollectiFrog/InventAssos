// Server-side session storage in PostgreSQL: the cookie holds only a signed random ID, so
// sessions can be listed and closed per user (US-0.2.7).
import { type Database, lt } from 'remix/data-table'
import { createSession, type SessionStorage } from 'remix/session'

import { sessions } from './tables.ts'

/** Session lifetime: 30 days (open point US-0.2.2). The cookie uses the same value. */
export const sessionMaxAgeSeconds = 30 * 24 * 60 * 60

/** Creates a SessionStorage backed by the `sessions` table. */
export function createPostgresSessionStorage(db: Database): SessionStorage {
  return {
    async read(cookie) {
      if (cookie == null || cookie === '') return createSession()

      const row = await db.find(sessions, cookie)
      if (row === null || new Date(String(row.expires_at)) <= new Date()) return createSession()

      // biome-ignore lint/suspicious/noExplicitAny: the stored JSON is the session's own data.
      return createSession(row.id, row.data as any)
    },

    async save(session) {
      if (session.deleteId) await db.delete(sessions, session.deleteId)

      if (session.destroyed) {
        await db.delete(sessions, session.id)
        return ''
      }

      if (!session.dirty) return null

      const [values] = session.data
      const userId = typeof values.userId === 'string' ? values.userId : null
      const row = {
        user_id: userId,
        // pg would send a JS array as a Postgres array, not JSON.
        data: JSON.stringify(session.data),
        expires_at: new Date(Date.now() + sessionMaxAgeSeconds * 1000),
      }

      // The same ID is saved again on every change.
      await db
        .query(sessions)
        .upsert({ id: session.id, ...row }, { conflictTarget: ['id'], update: row })

      return session.id
    },
  }
}

/** Closes every session of a user, e.g. when an admin disables the account. */
export async function deleteUserSessions(db: Database, userId: string): Promise<void> {
  await db.deleteMany(sessions, { where: { user_id: userId } })
}

/** Removes expired sessions; cheap enough to run at startup. */
export async function deleteExpiredSessions(db: Database): Promise<void> {
  await db.deleteMany(sessions, { where: lt(sessions.expires_at, new Date()) })
}
