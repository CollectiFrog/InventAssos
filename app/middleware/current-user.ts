import type { Database } from 'remix/data-table'
import { createContextKey, type Middleware } from 'remix/router'
import { Session } from 'remix/session'
import { type CollectifLink, listManagedCollectifs } from '../data/members.ts'
import type { UserStatus } from '../data/tables.ts'
import { findUserById } from '../data/users.ts'

/** The signed-in person as the rest of the app sees them. */
export interface CurrentUser {
  id: string
  name: string
  email: string
  status: UserStatus
  /** Checked against PLATFORM_ADMIN_EMAILS (read at startup) on every request, never a stored flag. */
  isAdmin: boolean
  /** Named by an admin (US-0.8.1); stored on the account. */
  isModerator: boolean
  /** IDs of the active collectifs this person is an active responsible of. */
  managedCollectifIds: ReadonlySet<string>
  /** The same collectifs, by name, for the sidebar's "Mes collectifs". */
  collectifs: readonly CollectifLink[]
}

/** Context key; actions read `context.currentUser` (null when nobody is signed in). */
export const CurrentUserKey = createContextKey<CurrentUser | null>()

/** Session key holding the signed-in user's ID. */
export const sessionUserKey = 'userId'

/** Statuses that keep a session and may sign in; disabled and deleted accounts may not. */
export const signedInStatuses: ReadonlySet<UserStatus> = new Set(['pending', 'active', 'rejected'])

/** Loads the user whose ID is in the session. Needs the session middleware before it. */
export function loadCurrentUser(
  db: Database,
  adminEmails: ReadonlySet<string>,
): Middleware<{ key: typeof CurrentUserKey; value: CurrentUser | null; property: 'currentUser' }> {
  return async (context, next) => {
    const session = context.get(Session)
    if (session === undefined)
      throw new Error('loadCurrentUser needs the session middleware before it')
    const userId = session.get(sessionUserKey)
    let current: CurrentUser | null = null

    if (typeof userId === 'string') {
      const user = await findUserById(db, userId)
      if (user !== null && signedInStatuses.has(user.status)) {
        const collectifs = user.status === 'active' ? await listManagedCollectifs(db, user.id) : []
        current = {
          id: user.id,
          name: user.name,
          email: user.email,
          status: user.status,
          isAdmin: adminEmails.has(user.email),
          isModerator: user.role === 'moderator',
          managedCollectifIds: new Set(collectifs.map((collectif) => collectif.id)),
          collectifs,
        }
      } else {
        session.destroy()
      }
    }

    context.set(CurrentUserKey, current, { property: 'currentUser' })
    return next()
  }
}
