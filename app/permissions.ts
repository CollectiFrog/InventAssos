// One function per action in docs/dev/architecture/permissions.md. Everything not allowed here is
// denied. Controllers call these on the server; hiding a button is never the only barrier.
import type { ItemScope } from './data/items.ts'
import type { CurrentUser } from './middleware/current-user.ts'

/** Who is acting: the signed-in user, or null for a visitor. */
export type Actor = CurrentUser | null

/** A platform admin with an active account. */
export function isActiveAdmin(actor: Actor): actor is CurrentUser {
  return actor !== null && actor.status === 'active' && actor.isAdmin
}

/** An active moderator (US-0.8.1); a listed admin is never treated as one. */
export function isActiveModerator(actor: Actor): boolean {
  return isValidatedUser(actor) && actor.isModerator && !actor.isAdmin
}

/**
 * Platform staff: an active admin or moderator, who run the approval queue (ADR 0020). Not a type
 * guard: a false answer says nothing about whether someone is signed in.
 */
export function isActiveStaff(actor: Actor): boolean {
  return isActiveAdmin(actor) || isActiveModerator(actor)
}

/** A validated (active) user, admin or not. */
export function isValidatedUser(actor: Actor): actor is CurrentUser {
  return actor !== null && actor.status === 'active'
}

/** "Approve or reject an account": admin or moderator. */
export function canReviewAccounts(actor: Actor): boolean {
  return isActiveStaff(actor)
}

/** "Manage own profile" (UC05): any validated user, for their own account only. */
export function canEditOwnProfile(actor: Actor): boolean {
  return isValidatedUser(actor)
}

/** An account as the account rules see it: who it is and which platform role it holds. */
export interface AccountTarget {
  id: string
  isListedAdmin: boolean
  isModerator: boolean
}

/** A moderator never acts on an admin or another moderator (US-0.8.2); an admin may. */
function staffMayActOn(actor: Actor, target: AccountTarget): boolean {
  if (target.isListedAdmin) return false
  return isActiveAdmin(actor) || !target.isModerator
}

/**
 * "Disable an account": admin or moderator; never their own account, nor a listed admin (one admin
 * must not lock the others out; they leave PLATFORM_ADMIN_EMAILS instead), nor, for a moderator,
 * another moderator.
 */
export function canDisableAccount(actor: Actor, target: AccountTarget): boolean {
  return isActiveStaff(actor) && actor?.id !== target.id && staffMayActOn(actor, target)
}

/** "Re-enable a disabled account": admin, or moderator if not a moderator's (US-0.6.5, US-0.8.2). */
export function canEnableAccount(actor: Actor, target: AccountTarget): boolean {
  return isActiveStaff(actor) && staffMayActOn(actor, target)
}

/** "Name or remove a moderator": admin only, among other validated accounts (US-0.8.1). */
export function canNameModerators(actor: Actor): boolean {
  return isActiveAdmin(actor)
}

/** "Request a new collectif": any validated user (admins and responsibles included). */
export function canRequestCollectif(actor: Actor): boolean {
  return isValidatedUser(actor)
}

/** "Add, rename, reorder, delete an unused category": admin or moderator. */
export function canManageCategories(actor: Actor): boolean {
  return isActiveStaff(actor)
}

/** "Approve or reject a collectif": admin or moderator. */
export function canReviewCollectifs(actor: Actor): boolean {
  return isActiveStaff(actor)
}

/**
 * "Request to become responsible of C": a validated user who does not belong to C yet. A member asks
 * C's responsibles instead (US-0.8.6), so that a refusal never costs them their membership.
 */
export function canRequestResponsibility(actor: Actor, collectifId: string): boolean {
  return isValidatedUser(actor) && !actor.memberCollectifIds.has(collectifId)
}

/** "Ask to join C" (US-0.8.3): a validated user who does not belong to C yet. */
export function canRequestMembership(actor: Actor, collectifId: string): boolean {
  return isValidatedUser(actor) && !actor.memberCollectifIds.has(collectifId)
}

/**
 * "Make a member of C responsible, remove a responsible of C" (US-0.8.6): a responsible of C, an
 * admin or a moderator, so that a collectif is never left without a responsible.
 */
export function canNameResponsibles(actor: Actor, collectifId: string): boolean {
  return (
    isActiveStaff(actor) || (isValidatedUser(actor) && actor.managedCollectifIds.has(collectifId))
  )
}

/** "Make a member of C responsible": as above, and never oneself unless admin. */
export function canPromoteToResponsible(
  actor: Actor,
  collectifId: string,
  userId: string,
): boolean {
  return canNameResponsibles(actor, collectifId) && decidesForSomeoneElse(actor, userId)
}

/** "Leave C" (US-0.8.8): any person of C; the last responsible names another one first. */
export function canLeaveCollectif(actor: Actor, collectifId: string): boolean {
  return isValidatedUser(actor) && actor.memberCollectifIds.has(collectifId)
}

/**
 * "Accept, reject or remove a member of C" (US-0.8.4): an active responsible of C only. The
 * platform approves accounts and collectifs, never who belongs to a collectif (ADR 0020).
 */
export function canManageMembers(actor: Actor, collectifId: string): boolean {
  return isValidatedUser(actor) && actor.managedCollectifIds.has(collectifId)
}

/** "Approve, reject or remove a responsible of C": admin or moderator. */
export function canManageResponsibles(actor: Actor): boolean {
  return isActiveStaff(actor)
}

/**
 * Nobody but an admin, who holds every right anyway, gives themselves a collectif: a moderator
 * never approves their own request, names themselves as a replacement or promotes themselves
 * (security review of V0.8). Moderators keep no manager right (ADR 0025).
 */
function decidesForSomeoneElse(actor: Actor, userId: string | null): boolean {
  if (actor === null || actor.isAdmin) return actor !== null
  return actor.id !== userId
}

/** "Approve a responsible of C" / name a replacement: staff, never for themselves (admins may). */
export function canMakeResponsibleByPlatform(actor: Actor, userId: string): boolean {
  return canManageResponsibles(actor) && decidesForSomeoneElse(actor, userId)
}

/** "Approve a collectif": staff, never the one they asked for themselves (admins may). */
export function canApproveCollectif(actor: Actor, requestedBy: string | null): boolean {
  return canReviewCollectifs(actor) && decidesForSomeoneElse(actor, requestedBy)
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

/** True when the location belongs to a collectif the actor is a member or responsible of. */
function isLocationOfMyCollectif(
  actor: CurrentUser,
  location: { collectif_id: string | null },
): boolean {
  return location.collectif_id !== null && actor.memberCollectifIds.has(location.collectif_id)
}

/**
 * "See a location's full address": its managers, the members of its collectif (US-0.8.5) and the
 * platform admin. Everybody else gets the city only (ADR 0010); notes follow the same rule since
 * they often hold access codes.
 */
export function canSeeFullAddress(
  actor: Actor,
  location: { collectif_id: string | null; user_id: string | null },
): boolean {
  if (isActiveAdmin(actor) || canManageLocation(actor, location)) return true
  return isValidatedUser(actor) && isLocationOfMyCollectif(actor, location)
}

/**
 * "Add an item to a location" / "Move an item to a location": admin, a manager of it, or a member
 * of its collectif (US-0.8.5).
 */
export function canStoreItemsIn(
  actor: Actor,
  location: { collectif_id: string | null; user_id: string | null },
): boolean {
  if (!isValidatedUser(actor)) return false
  return (
    actor.isAdmin || canManageLocation(actor, location) || isLocationOfMyCollectif(actor, location)
  )
}

/** May the actor own an item as this owner: themselves, or a collectif they belong to (US-0.8.5). */
export function canAssignItemOwner(
  actor: Actor,
  owner: { collectifId: string } | { userId: string },
): boolean {
  if (!isValidatedUser(actor)) return false
  if ('userId' in owner) return owner.userId === actor.id
  return actor.isAdmin || actor.memberCollectifIds.has(owner.collectifId)
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
 * by C; member of C if owned by C (US-0.8.5); validated user if they own it or it is in their own
 * location (ADR 0009).
 */
export function canEditItem(actor: Actor, item: ItemAccess): boolean {
  if (!isValidatedUser(actor)) return false
  if (actor.isAdmin) return true
  if (item.owner_user_id === actor.id) return true
  if (item.owner_collectif_id !== null && actor.memberCollectifIds.has(item.owner_collectif_id)) {
    return true
  }
  return canManageLocation(actor, {
    collectif_id: item.locationCollectifId,
    user_id: item.locationUserId,
  })
}

/**
 * "Edit, move or archive an archived item": nobody. An archived item has left the inventory
 * (US-0.5.5); its managers still see its page and history, but it no longer changes.
 */
export function canChangeItem(actor: Actor, item: ItemAccess & { archived_at: unknown }): boolean {
  return item.archived_at == null && canEditItem(actor, item)
}

/**
 * "Archive an abusive item" (US-0.8.2): admin or moderator, on any item still in the inventory.
 * The owner is e-mailed the reason.
 */
export function canModerateItem(actor: Actor, item: { archived_at: unknown }): boolean {
  return isActiveStaff(actor) && item.archived_at == null
}

/**
 * "Delete an item" (US-0.8.9): its personal owner, a responsible of its owning collectif, an admin
 * or a moderator; archived or not. Deletion is final, so a member of C asks instead (US-0.8.10).
 */
export function canDeleteItem(
  actor: Actor,
  item: { owner_collectif_id: string | null; owner_user_id: string | null },
): boolean {
  if (!isValidatedUser(actor)) return false
  if (isActiveStaff(actor) || item.owner_user_id === actor.id) return true
  return item.owner_collectif_id !== null && actor.managedCollectifIds.has(item.owner_collectif_id)
}

/** "Ask to delete an item of C" (US-0.8.10): a member of C who may not delete it themselves. */
export function canRequestItemDeletion(
  actor: Actor,
  item: { owner_collectif_id: string | null; owner_user_id: string | null },
): boolean {
  if (!isValidatedUser(actor) || canDeleteItem(actor, item)) return false
  return item.owner_collectif_id !== null && actor.memberCollectifIds.has(item.owner_collectif_id)
}

/** "Accept or reject a request to delete an item of C" (US-0.8.10): a responsible of C. */
export function canDecideItemDeletion(actor: Actor, collectifId: string): boolean {
  return isValidatedUser(actor) && actor.managedCollectifIds.has(collectifId)
}

/** True when the actor belongs to one of these collectifs, as member or responsible. */
function sharesCollectif(actor: CurrentUser, collectifIds: readonly string[]): boolean {
  return collectifIds.some((id) => actor.memberCollectifIds.has(id))
}

/** An item as visibility needs it: its owner and storage, and the owning person's collectifs. */
export interface ItemVisibility extends ItemAccess {
  /** Collectifs the owning person belongs to; empty when a collectif owns the item. */
  ownerCollectifIds: readonly string[]
}

/**
 * "See an item, its owner, the city of its location" (ADR 0021): admin or moderator; owned by C or by a person
 * of C, or stored in C's location; owner, or stored in own location. `itemScopeOf` mirrors it in SQL.
 */
export function canSeeItem(actor: Actor, item: ItemVisibility): boolean {
  if (!isValidatedUser(actor)) return false
  if (isActiveStaff(actor) || item.owner_user_id === actor.id) return true
  if (item.owner_collectif_id !== null && actor.memberCollectifIds.has(item.owner_collectif_id)) {
    return true
  }
  if (item.owner_user_id !== null && sharesCollectif(actor, item.ownerCollectifIds)) return true
  // Stored in a location I keep: my own, or one of a collectif I belong to.
  if (item.locationUserId !== null) return item.locationUserId === actor.id
  return item.locationCollectifId !== null && actor.memberCollectifIds.has(item.locationCollectifId)
}

/** The listings' side of `canSeeItem`: every query that lists items filters with this scope. */
export function itemScopeOf(actor: CurrentUser): ItemScope {
  if (isActiveStaff(actor)) return { everything: true }
  return { everything: false, userId: actor.id, collectifIds: [...actor.memberCollectifIds] }
}

/** "See a person's page and phone": staff, the person, or someone sharing a collectif (ADR 0021). */
export function canSeePerson(
  actor: Actor,
  person: { id: string; collectifIds: readonly string[] },
): boolean {
  if (!isValidatedUser(actor)) return false
  return (
    isActiveStaff(actor) || actor.id === person.id || sharesCollectif(actor, person.collectifIds)
  )
}

/**
 * "See C's equipment, locations and responsibles": admin or moderator, or a person of C. Everybody else sees
 * the directory entry only: name, city and description (ADR 0021).
 */
export function canSeeCollectifInventory(actor: Actor, collectifId: string): boolean {
  if (!isValidatedUser(actor)) return false
  return isActiveStaff(actor) || actor.memberCollectifIds.has(collectifId)
}

/**
 * "See a location (name, city)": admin or moderator, its managers, the people of its collectif, or
 * whoever sees an item stored there, since the item page links to it (ADR 0021).
 */
export function canSeeLocation(
  actor: Actor,
  location: { collectif_id: string | null; user_id: string | null },
  seesAnItemThere: boolean,
): boolean {
  if (!isValidatedUser(actor)) return false
  if (isActiveStaff(actor) || canManageLocation(actor, location) || seesAnItemThere) return true
  return location.collectif_id !== null && actor.memberCollectifIds.has(location.collectif_id)
}
