import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import type { CurrentUser } from './middleware/current-user.ts'
import {
  canAssignItemOwner,
  canChangeItem,
  canDepositForPerson,
  canDisableAccount,
  canEditCollectif,
  canEditItem,
  canEditOwnProfile,
  canEnableAccount,
  canLeaveCollectif,
  canManageCategories,
  canManageCollectifLocations,
  canManageMembers,
  canManagePersonalLocations,
  canManageResponsibles,
  canModerateItem,
  canNameModerators,
  canNameResponsibles,
  canRequestCollectif,
  canRequestMembership,
  canRequestResponsibility,
  canReviewAccounts,
  canReviewCollectifs,
  canSeeCollectifInventory,
  canSeeFullAddress,
  canSeeItem,
  canSeeLocation,
  canSeePerson,
  canStoreItemsIn,
  itemScopeOf,
} from './permissions.ts'

/** A test actor; a responsible belongs to the collectifs they manage unless told otherwise. */
function user(overrides: Partial<CurrentUser> = {}): CurrentUser {
  return {
    memberCollectifIds: overrides.managedCollectifIds ?? new Set(),
    id: 'u1',
    name: 'U',
    email: 'u@x.org',
    status: 'active',
    isAdmin: false,
    isModerator: false,
    managedCollectifIds: new Set(),
    collectifs: [],
    ...overrides,
  }
}

const moderator = (overrides: Partial<CurrentUser> = {}) =>
  user({ isModerator: true, ...overrides })

describe('permissions: accounts', () => {
  it('"Approve or reject an account": admin and moderator yes, validated user no, visitor no', () => {
    assert.equal(canReviewAccounts(user({ isAdmin: true })), true)
    assert.equal(canReviewAccounts(moderator()), true)
    assert.equal(canReviewAccounts(moderator({ status: 'disabled' })), false)
    assert.equal(canReviewAccounts(user()), false)
    assert.equal(canReviewAccounts(null), false)
    assert.equal(canReviewAccounts(user({ isAdmin: true, status: 'pending' })), false)
  })

  it('"Manage own profile": validated users only', () => {
    assert.equal(canEditOwnProfile(user()), true)
    assert.equal(canEditOwnProfile(user({ status: 'pending' })), false)
    assert.equal(canEditOwnProfile(null), false)
  })

  const member = { id: 'u2', isListedAdmin: false, isModerator: false }
  const otherModerator = { ...member, isModerator: true }
  const listedAdmin = { ...member, isListedAdmin: true }

  it('"Disable an account": admin or moderator, never their own account nor a listed admin', () => {
    assert.equal(canDisableAccount(user({ isAdmin: true }), member), true)
    assert.equal(canDisableAccount(user({ isAdmin: true }), { ...member, id: 'u1' }), false)
    assert.equal(canDisableAccount(user({ isAdmin: true }), listedAdmin), false)
    assert.equal(canDisableAccount(user({ isAdmin: true }), otherModerator), true)
    assert.equal(canDisableAccount(moderator(), member), true)
    assert.equal(canDisableAccount(moderator(), { ...member, id: 'u1' }), false)
    assert.equal(canDisableAccount(user(), member), false)
    assert.equal(canDisableAccount(null, member), false)
  })

  it('"Disable an account": a moderator never acts on an admin or another moderator', () => {
    assert.equal(canDisableAccount(moderator(), listedAdmin), false)
    assert.equal(canDisableAccount(moderator(), otherModerator), false)
  })

  it('"Re-enable a disabled account": admin, or moderator for a member', () => {
    assert.equal(canEnableAccount(user({ isAdmin: true }), member), true)
    assert.equal(canEnableAccount(user({ isAdmin: true }), otherModerator), true)
    assert.equal(canEnableAccount(user({ isAdmin: true, status: 'pending' }), member), false)
    assert.equal(canEnableAccount(moderator(), member), true)
    assert.equal(canEnableAccount(moderator(), otherModerator), false)
    assert.equal(canEnableAccount(user({ managedCollectifIds: new Set(['c1']) }), member), false)
    assert.equal(canEnableAccount(null, member), false)
  })

  it('"Name or remove a moderator": admin only', () => {
    assert.equal(canNameModerators(user({ isAdmin: true })), true)
    assert.equal(canNameModerators(moderator()), false)
    assert.equal(canNameModerators(user()), false)
    assert.equal(canNameModerators(null), false)
  })

  it('"Add, rename, reorder, delete an unused category": admin and moderator', () => {
    assert.equal(canManageCategories(user({ isAdmin: true })), true)
    assert.equal(canManageCategories(moderator()), true)
    assert.equal(canManageCategories(user()), false)
  })

  it('"Archive an abusive item": admin and moderator, on an item still in the inventory', () => {
    assert.equal(canModerateItem(user({ isAdmin: true }), { archived_at: null }), true)
    assert.equal(canModerateItem(moderator(), { archived_at: null }), true)
    assert.equal(canModerateItem(moderator(), { archived_at: new Date() }), false)
    assert.equal(canModerateItem(user(), { archived_at: null }), false)
    assert.equal(canModerateItem(null, { archived_at: null }), false)
  })

  it('a moderator gets no manager rights: no location, no item edit', () => {
    const item = {
      owner_collectif_id: 'c1',
      owner_user_id: null,
      locationCollectifId: 'c1',
      locationUserId: null,
    }
    assert.equal(canEditItem(moderator(), item), false)
    assert.equal(canManageCollectifLocations(moderator(), 'c1'), false)
    assert.equal(canSeeFullAddress(moderator(), { collectif_id: 'c1', user_id: null }), false)
  })

  it('"Request a new collectif": any validated user, admin included', () => {
    assert.equal(canRequestCollectif(user()), true)
    assert.equal(canRequestCollectif(user({ isAdmin: true })), true)
    assert.equal(canRequestCollectif(user({ status: 'pending' })), false)
    assert.equal(canRequestCollectif(null), false)
  })

  it('"Approve or reject a collectif": admin and moderator', () => {
    assert.equal(canReviewCollectifs(user({ isAdmin: true })), true)
    assert.equal(canReviewCollectifs(moderator()), true)
    assert.equal(canReviewCollectifs(user({ managedCollectifIds: new Set(['c1']) })), false)
    assert.equal(canReviewCollectifs(null), false)
  })

  it('"Request to become responsible of C": validated user not already responsible of C', () => {
    assert.equal(canRequestResponsibility(user(), 'c1'), true)
    assert.equal(
      canRequestResponsibility(user({ managedCollectifIds: new Set(['c1']) }), 'c1'),
      false,
    )
    assert.equal(
      canRequestResponsibility(user({ managedCollectifIds: new Set(['c2']) }), 'c1'),
      true,
    )
    assert.equal(canRequestResponsibility(user({ status: 'pending' }), 'c1'), false)
    assert.equal(canRequestResponsibility(null, 'c1'), false)
  })

  it('"Ask to join C": a validated user who does not belong to C yet', () => {
    assert.equal(canRequestMembership(user(), 'c1'), true)
    assert.equal(canRequestMembership(user({ isAdmin: true }), 'c1'), true)
    assert.equal(canRequestMembership(user({ memberCollectifIds: new Set(['c1']) }), 'c1'), false)
    assert.equal(canRequestMembership(user({ managedCollectifIds: new Set(['c1']) }), 'c1'), false)
    assert.equal(canRequestMembership(user({ status: 'pending' }), 'c1'), false)
    assert.equal(canRequestMembership(null, 'c1'), false)
  })

  it('"Accept, reject or remove a member of C": responsibles of C only, not the platform', () => {
    assert.equal(canManageMembers(user({ managedCollectifIds: new Set(['c1']) }), 'c1'), true)
    assert.equal(canManageMembers(user({ managedCollectifIds: new Set(['c2']) }), 'c1'), false)
    assert.equal(canManageMembers(user({ memberCollectifIds: new Set(['c1']) }), 'c1'), false)
    assert.equal(canManageMembers(user({ isAdmin: true }), 'c1'), false)
    assert.equal(canManageMembers(moderator(), 'c1'), false)
  })

  it('"Request to become responsible of C": not for a member of C, who asks C\'s responsibles', () => {
    assert.equal(
      canRequestResponsibility(user({ memberCollectifIds: new Set(['c1']) }), 'c1'),
      false,
    )
  })

  it('"Make a member of C responsible, remove a responsible of C": its responsibles and staff', () => {
    assert.equal(canNameResponsibles(user({ managedCollectifIds: new Set(['c1']) }), 'c1'), true)
    assert.equal(canNameResponsibles(user({ isAdmin: true }), 'c1'), true)
    assert.equal(canNameResponsibles(moderator(), 'c1'), true)
    assert.equal(canNameResponsibles(user({ memberCollectifIds: new Set(['c1']) }), 'c1'), false)
    assert.equal(canNameResponsibles(user({ managedCollectifIds: new Set(['c2']) }), 'c1'), false)
    assert.equal(canNameResponsibles(null, 'c1'), false)
  })

  it('"Leave C": any person of C', () => {
    assert.equal(canLeaveCollectif(user({ memberCollectifIds: new Set(['c1']) }), 'c1'), true)
    assert.equal(canLeaveCollectif(user({ managedCollectifIds: new Set(['c1']) }), 'c1'), true)
    assert.equal(canLeaveCollectif(user(), 'c1'), false)
    assert.equal(canLeaveCollectif(user({ isAdmin: true }), 'c1'), false)
  })

  it('"Approve, reject or remove a responsible of C": admin and moderator, not a responsible', () => {
    assert.equal(canManageResponsibles(user({ isAdmin: true })), true)
    assert.equal(canManageResponsibles(moderator()), true)
    assert.equal(canManageResponsibles(user({ managedCollectifIds: new Set(['c1']) })), false)
    assert.equal(canManageResponsibles(null), false)
  })

  it('"Edit C\'s profile": admin yes, responsible of C yes, others no', () => {
    assert.equal(canEditCollectif(user({ isAdmin: true }), 'c1'), true)
    assert.equal(canEditCollectif(user({ managedCollectifIds: new Set(['c1']) }), 'c1'), true)
    assert.equal(canEditCollectif(user({ managedCollectifIds: new Set(['c2']) }), 'c1'), false)
    assert.equal(canEditCollectif(user(), 'c1'), false)
    assert.equal(canEditCollectif(null, 'c1'), false)
  })

  it('"Create, edit, delete C\'s locations": admin and responsible of C', () => {
    assert.equal(canManageCollectifLocations(user({ isAdmin: true }), 'c1'), true)
    assert.equal(
      canManageCollectifLocations(user({ managedCollectifIds: new Set(['c1']) }), 'c1'),
      true,
    )
    assert.equal(
      canManageCollectifLocations(user({ managedCollectifIds: new Set(['c2']) }), 'c1'),
      false,
    )
    assert.equal(canManageCollectifLocations(user(), 'c1'), false)
    assert.equal(canManageCollectifLocations(null, 'c1'), false)
  })

  it('"Create, edit, delete own personal locations": the owner only, admins too for their own', () => {
    assert.equal(canManagePersonalLocations(user(), 'u1'), true)
    assert.equal(canManagePersonalLocations(user(), 'u2'), false)
    assert.equal(canManagePersonalLocations(user({ isAdmin: true }), 'u2'), false)
    assert.equal(canManagePersonalLocations(user({ status: 'pending' }), 'u1'), false)
    assert.equal(canManagePersonalLocations(null, 'u1'), false)
  })

  it('"See a location\'s full address": admin, responsible of the owning collectif, owner', () => {
    const collectifPlace = { collectif_id: 'c1', user_id: null }
    const homePlace = { collectif_id: null, user_id: 'u2' }
    assert.equal(canSeeFullAddress(user({ isAdmin: true }), homePlace), true)
    assert.equal(
      canSeeFullAddress(user({ managedCollectifIds: new Set(['c1']) }), collectifPlace),
      true,
    )
    assert.equal(canSeeFullAddress(user({ id: 'u2' }), homePlace), true)
    assert.equal(canSeeFullAddress(user(), collectifPlace), false)
    assert.equal(canSeeFullAddress(user(), homePlace), false)
    assert.equal(canSeeFullAddress(null, homePlace), false)
  })

  it('"Add an item to a location": admin; responsible if C\'s location; user if own location', () => {
    const collectifPlace = { collectif_id: 'c1', user_id: null }
    const homePlace = { collectif_id: null, user_id: 'u1' }
    assert.equal(
      canStoreItemsIn(user({ isAdmin: true }), { collectif_id: null, user_id: 'u9' }),
      true,
    )
    assert.equal(
      canStoreItemsIn(user({ managedCollectifIds: new Set(['c1']) }), collectifPlace),
      true,
    )
    assert.equal(canStoreItemsIn(user(), collectifPlace), false)
    assert.equal(canStoreItemsIn(user(), homePlace), true)
    assert.equal(canStoreItemsIn(user({ id: 'u2' }), homePlace), false)
    assert.equal(canStoreItemsIn(null, homePlace), false)
  })

  it('item owner: oneself, or a collectif one manages', () => {
    assert.equal(canAssignItemOwner(user(), { userId: 'u1' }), true)
    assert.equal(canAssignItemOwner(user(), { userId: 'u2' }), false)
    assert.equal(
      canAssignItemOwner(user({ managedCollectifIds: new Set(['c1']) }), { collectifId: 'c1' }),
      true,
    )
    assert.equal(canAssignItemOwner(user(), { collectifId: 'c1' }), false)
  })

  it("a person's item in C's location: set by C's responsible or the admin", () => {
    const collectifPlace = { collectif_id: 'c1', user_id: null }
    assert.equal(
      canDepositForPerson(user({ managedCollectifIds: new Set(['c1']) }), collectifPlace),
      true,
    )
    assert.equal(canDepositForPerson(user({ isAdmin: true }), collectifPlace), true)
    assert.equal(canDepositForPerson(user(), collectifPlace), false)
    assert.equal(
      canDepositForPerson(user({ isAdmin: true }), { collectif_id: null, user_id: 'u1' }),
      false,
    )
  })

  it('"Edit, move, archive an item": admin, owner, owning collectif, location manager', () => {
    const item = {
      owner_collectif_id: 'c1',
      owner_user_id: null,
      locationCollectifId: null,
      locationUserId: 'u5',
    }
    assert.equal(canEditItem(user({ isAdmin: true }), item), true)
    assert.equal(canEditItem(user({ managedCollectifIds: new Set(['c1']) }), item), true)
    assert.equal(canEditItem(user({ id: 'u5' }), item), true)
    assert.equal(canEditItem(user({ managedCollectifIds: new Set(['c2']) }), item), false)
    assert.equal(canEditItem(user(), item), false)
    const deposit = {
      owner_collectif_id: null,
      owner_user_id: 'u1',
      locationCollectifId: 'c2',
      locationUserId: null,
    }
    assert.equal(canEditItem(user(), deposit), true)
    assert.equal(
      canEditItem(user({ id: 'u3', managedCollectifIds: new Set(['c2']) }), deposit),
      true,
    )
    assert.equal(canEditItem(null, deposit), false)
  })

  it('"Edit, move or archive an archived item": nobody, not even the admin', () => {
    const item = {
      owner_collectif_id: null,
      owner_user_id: 'u1',
      locationCollectifId: null,
      locationUserId: 'u1',
      archived_at: null,
    }
    assert.equal(canChangeItem(user(), item), true)
    const archived = { ...item, archived_at: new Date() }
    assert.equal(canChangeItem(user(), archived), false)
    assert.equal(canChangeItem(user({ isAdmin: true }), archived), false)
    assert.equal(canChangeItem(user({ id: 'u2' }), item), false)
  })
})

describe('permissions: visibility (ADR 0021)', () => {
  // Owned by person u9, stored at u9's home; u9 belongs to c9.
  const item = {
    owner_collectif_id: null,
    owner_user_id: 'u9',
    locationCollectifId: null,
    locationUserId: 'u9',
    ownerCollectifIds: ['c9'],
  }
  const responsibleOf = (...ids: string[]) => user({ managedCollectifIds: new Set(ids) })

  it("shows an item to its owner, the admin, and people of its owner's collectifs", () => {
    assert.equal(canSeeItem(user({ id: 'u9' }), item), true)
    assert.equal(canSeeItem(user({ isAdmin: true }), item), true)
    assert.equal(canSeeItem(responsibleOf('c9'), item), true)
    assert.equal(canSeeItem(responsibleOf('c1'), item), false)
    assert.equal(canSeeItem(user(), item), false)
  })

  it('shows a collectif item to its people, and any item to whoever manages its location', () => {
    const owned = { ...item, owner_user_id: null, owner_collectif_id: 'c1', ownerCollectifIds: [] }
    assert.equal(canSeeItem(responsibleOf('c1'), owned), true)
    assert.equal(canSeeItem(responsibleOf('c2'), owned), false)
    assert.equal(canSeeItem(user({ id: 'u9' }), owned), true, 'stored at u9')
    const atC2 = { ...item, locationUserId: null, locationCollectifId: 'c2' }
    assert.equal(canSeeItem(responsibleOf('c2'), atC2), true)
  })

  it('shows nothing to a pending account', () => {
    assert.equal(canSeeItem(user({ id: 'u9', status: 'pending' }), item), false)
    assert.equal(canSeePerson(user({ status: 'pending' }), { id: 'u1', collectifIds: [] }), false)
  })

  it('shows a person to themselves, the admin and who shares a collectif with them', () => {
    const person = { id: 'u9', collectifIds: ['c9'] }
    assert.equal(canSeePerson(user({ id: 'u9' }), person), true)
    assert.equal(canSeePerson(user({ isAdmin: true }), person), true)
    assert.equal(canSeePerson(responsibleOf('c9'), person), true)
    assert.equal(canSeePerson(responsibleOf('c1'), person), false)
  })

  it("shows a collectif's inside to its people and the admin only", () => {
    assert.equal(canSeeCollectifInventory(responsibleOf('c1'), 'c1'), true)
    assert.equal(canSeeCollectifInventory(user({ isAdmin: true }), 'c1'), true)
    assert.equal(canSeeCollectifInventory(responsibleOf('c2'), 'c1'), false)
  })

  it('shows a location to its managers, the admin, and who sees an item stored there', () => {
    const home = { collectif_id: null, user_id: 'u9' }
    assert.equal(canSeeLocation(user({ id: 'u9' }), home, false), true)
    assert.equal(canSeeLocation(user({ isAdmin: true }), home, false), true)
    assert.equal(canSeeLocation(user(), home, true), true)
    assert.equal(canSeeLocation(user(), home, false), false)
  })

  it('lets a member of C keep its equipment: add, edit, move, archive, full address (US-0.8.5)', () => {
    const member = user({ memberCollectifIds: new Set(['c9']) })
    const local = { collectif_id: 'c9', user_id: null }
    assert.equal(canStoreItemsIn(member, local), true)
    assert.equal(canStoreItemsIn(member, { collectif_id: 'c8', user_id: null }), false)
    assert.equal(canAssignItemOwner(member, { collectifId: 'c9' }), true)
    assert.equal(canAssignItemOwner(member, { collectifId: 'c8' }), false)
    assert.equal(canSeeFullAddress(member, local), true)
    assert.equal(canSeeFullAddress(member, { collectif_id: 'c8', user_id: null }), false)
    const ofC = {
      owner_collectif_id: 'c9',
      owner_user_id: null,
      locationCollectifId: null,
      locationUserId: 'u7',
    }
    assert.equal(canEditItem(member, ofC), true, 'owned by C, wherever it is')
    const deposit = {
      owner_collectif_id: null,
      owner_user_id: 'u7',
      locationCollectifId: 'c9',
      locationUserId: null,
    }
    assert.equal(
      canEditItem(member, deposit),
      false,
      "someone's deposit stays with C's responsibles",
    )
    assert.equal(canDepositForPerson(member, local), false)
  })

  it('lets a member of C see like a responsible, without managing anything', () => {
    const member = user({ memberCollectifIds: new Set(['c9']) })
    assert.equal(canSeeItem(member, item), true, 'owned by a person of C')
    const owned = { ...item, owner_user_id: null, owner_collectif_id: 'c9', ownerCollectifIds: [] }
    assert.equal(canSeeItem(member, owned), true, 'owned by C')
    const atC = {
      ...item,
      owner_user_id: 'u7',
      ownerCollectifIds: [],
      locationUserId: null,
      locationCollectifId: 'c9',
    }
    assert.equal(canSeeItem(member, atC), true, "stored in C's location")
    assert.equal(canSeeCollectifInventory(member, 'c9'), true)
    assert.equal(canSeePerson(member, { id: 'u9', collectifIds: ['c9'] }), true)
    assert.equal(canSeeLocation(member, { collectif_id: 'c9', user_id: null }, false), true)
    assert.equal(canManageCollectifLocations(member, 'c9'), false)
    assert.equal(canManageMembers(member, 'c9'), false)
    assert.deepEqual(itemScopeOf(member), { everything: false, userId: 'u1', collectifIds: ['c9'] })
  })

  it('shows moderators everything, like admins (ADR 0021 open point, settled in V0.8)', () => {
    const owned = { ...item, owner_user_id: null, owner_collectif_id: 'c1', ownerCollectifIds: [] }
    assert.equal(canSeeItem(moderator(), item), true)
    assert.equal(canSeeItem(moderator(), owned), true)
    assert.equal(canSeePerson(moderator(), { id: 'u9', collectifIds: ['c9'] }), true)
    assert.equal(canSeeCollectifInventory(moderator(), 'c1'), true)
    assert.equal(canSeeLocation(moderator(), { collectif_id: null, user_id: 'u9' }, false), true)
    assert.deepEqual(itemScopeOf(moderator()), { everything: true })
    assert.equal(canSeeItem(moderator({ status: 'disabled' }), item), false)
  })

  it('gives listings the same scope: everything for the admin, else me and my collectifs', () => {
    assert.deepEqual(itemScopeOf(user({ isAdmin: true })), { everything: true })
    assert.deepEqual(itemScopeOf(responsibleOf('c1')), {
      everything: false,
      userId: 'u1',
      collectifIds: ['c1'],
    })
  })
})
