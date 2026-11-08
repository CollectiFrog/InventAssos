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

/** "Disable an account": platform admin only, and never their own account. */
export function canDisableAccount(actor: Actor, targetUserId: string): boolean {
  return isActiveAdmin(actor) && actor.id !== targetUserId
}

/** "Request a new collectif": any validated user (admins and responsibles included). */
export function canRequestCollectif(actor: Actor): boolean {
  return isValidatedUser(actor)
}

/** "Approve or reject a collectif": platform admin only. */
export function canReviewCollectifs(actor: Actor): boolean {
  return isActiveAdmin(actor)
}

/** "Request to become responsible of C": a validated user who is not already responsible of C. */
export function canRequestResponsibility(actor: Actor, collectifId: string): boolean {
  return isValidatedUser(actor) && !actor.managedCollectifIds.has(collectifId)
}

/** "Approve, reject or remove a responsible of C": platform admin only. */
export function canManageResponsibles(actor: Actor): boolean {
  return isActiveAdmin(actor)
}

/** "Edit C's profile": platform admin, or an active responsible of C. */
export function canEditCollectif(actor: Actor, collectifId: string): boolean {
  if (!isValidatedUser(actor)) return false
  return actor.isAdmin || actor.managedCollectifIds.has(collectifId)
}

/** "Create, edit, delete C's locations": platform admin, or an active responsible of C. */
export function canManageCollectifLocations(actor: Actor, collectifId: string): boolean {
  if (!isValidatedUser(actor)) return false
  return actor.isAdmin || actor.managedCollectifIds.has(collectifId)
}

/** "Create, edit, delete own personal locations": the owner only, admins included for their own. */
export function canManagePersonalLocations(actor: Actor, ownerUserId: string): boolean {
  return isValidatedUser(actor) && actor.id === ownerUserId
}

/** Whoever may edit or delete this location, according to its owner. */
export function canManageLocation(
  actor: Actor,
  location: { collectif_id: string | null; user_id: string | null },
): boolean {
  if (location.collectif_id !== null) {
    return canManageCollectifLocations(actor, location.collectif_id)
  }
  if (location.user_id !== null) return canManagePersonalLocations(actor, location.user_id)
  return false
}
