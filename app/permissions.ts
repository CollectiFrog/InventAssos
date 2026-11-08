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

/**
 * "See a location's full address": its managers and the platform admin. Everybody else gets the
 * city only (ADR 0010); notes follow the same rule since they often hold access codes.
 */
export function canSeeFullAddress(
  actor: Actor,
  location: { collectif_id: string | null; user_id: string | null },
): boolean {
  return isActiveAdmin(actor) || canManageLocation(actor, location)
}

/** "Add an item to a location" / "Move an item to a location": admin, or a manager of it. */
export function canStoreItemsIn(
  actor: Actor,
  location: { collectif_id: string | null; user_id: string | null },
): boolean {
  return isValidatedUser(actor) && (actor.isAdmin || canManageLocation(actor, location))
}

/** May the actor own an item as this owner: themselves, or a collectif they manage. */
export function canAssignItemOwner(
  actor: Actor,
  owner: { collectifId: string } | { userId: string },
): boolean {
  if (!isValidatedUser(actor)) return false
  if ('userId' in owner) return owner.userId === actor.id
  return actor.isAdmin || actor.managedCollectifIds.has(owner.collectifId)
}

/**
 * US-0.5.2: a person may own an item stored in a collectif's location, set by whoever manages
 * that location (a responsible of C, or the admin). The person must be a validated account.
 */
export function canDepositForPerson(
  actor: Actor,
  location: { collectif_id: string | null; user_id: string | null },
): boolean {
  return location.collectif_id !== null && canManageCollectifLocations(actor, location.collectif_id)
}

/** The ownership and storage of an item, as the permission checks need them. */
export interface ItemAccess {
  owner_collectif_id: string | null
  owner_user_id: string | null
  /** Owner of the location the item is stored in. */
  locationCollectifId: string | null
  locationUserId: string | null
}

/**
 * "Edit, move, archive an item": admin; responsible of C if the item is in C's location or owned
 * by C; validated user if they own it or it is in their own location (ADR 0009).
 */
export function canEditItem(actor: Actor, item: ItemAccess): boolean {
  if (!isValidatedUser(actor)) return false
  if (actor.isAdmin) return true
  if (item.owner_user_id === actor.id) return true
  if (item.owner_collectif_id !== null && actor.managedCollectifIds.has(item.owner_collectif_id)) {
    return true
  }
  return canManageLocation(actor, {
    collectif_id: item.locationCollectifId,
    user_id: item.locationUserId,
  })
}
