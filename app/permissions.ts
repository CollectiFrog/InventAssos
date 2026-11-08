// One function per action in docs/dev/architecture/permissions.md. Everything not allowed here is
// denied. Controllers call these on the server; hiding a button is never the only barrier.
import type { CurrentUser } from './middleware/current-user.ts'

/** Who is acting: the signed-in user, or null for a visitor. */
export type Actor = CurrentUser | null

/** A platform admin with an active account. */
export function isActiveAdmin(actor: Actor): actor is CurrentUser {
  return actor !== null && actor.status === 'active' && actor.isAdmin
}

/** A validated (active) user, admin or not. */
export function isValidatedUser(actor: Actor): actor is CurrentUser {
  return actor !== null && actor.status === 'active'
}

/** "Approve or reject an account": platform admin only. */
export function canReviewAccounts(actor: Actor): boolean {
  return isActiveAdmin(actor)
}

/** "Manage own profile" (UC05): any validated user, for their own account only. */
export function canEditOwnProfile(actor: Actor): boolean {
  return isValidatedUser(actor)
}
