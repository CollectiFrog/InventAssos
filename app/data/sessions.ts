// Session storage (ADR 0017). A signed-in session lives in PostgreSQL and the cookie holds only its
// signed random ID, so sessions can be closed per user (US-0.2.7). A visitor's session (CSRF token,
// flash messages) stays in the signed cookie itself: browsing anonymously never creates a row.
import { type Database, lt } from 'remix/data-table'
import { createSession, type Session, type SessionStorage } from 'remix/session'

import { sessions } from './tables.ts'

/** Session lifetime: 30 days (open point US-0.2.2). The cookie uses the same value. */
export const sessionMaxAgeSeconds = 30 * 24 * 60 * 60

/** Creates a SessionStorage backed by the `sessions` table. */
export function createPostgresSessionStorage(db: Database): SessionStorage {
  return {
    async read(cookie) {
      if (cookie == null || cookie === '') return createSession()
      if (cookie.startsWith('{')) return readVisitorSession(cookie)

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
      if (userId === null) return JSON.stringify({ i: session.id, d: session.data })

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

/**
 * A visitor's session from its cookie. The cookie is signed, but identity must stay revocable
 * (US-0.2.7): a cookie that claims a user is ignored, only a database row may sign someone in.
 */
function readVisitorSession(cookie: string): Session {
  try {
    const parsed = JSON.parse(cookie) as { i?: unknown; d?: unknown }
    const data = parsed.d
    if (typeof parsed.i !== 'string' || !Array.isArray(data) || data.length !== 2) {
      return createSession()
    }
    if (typeof data[0] !== 'object' || data[0] === null || 'userId' in data[0]) {
      return createSession()
    }
    // biome-ignore lint/suspicious/noExplicitAny: the signed cookie holds the session's own data.
    return createSession(parsed.i, data as any)
  } catch {
    return createSession()
  }
}

/** Closes every session of a user, e.g. when an admin disables the account. */
export async function deleteUserSessions(db: Database, userId: string): Promise<void> {
  await db.deleteMany(sessions, { where: { user_id: userId } })
}

/** Removes expired sessions; run at startup and then periodically (`app/maintenance.ts`). */
export async function deleteExpiredSessions(db: Database): Promise<void> {
  await db.deleteMany(sessions, { where: lt(sessions.expires_at, new Date()) })
}
