import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import type { CurrentUser } from './middleware/current-user.ts'
import {
  canAssignItemOwner,
  canDepositForPerson,
  canDisableAccount,
  canEditCollectif,
  canEditItem,
  canEditOwnProfile,
  canManageCollectifLocations,
  canManagePersonalLocations,
  canManageResponsibles,
  canRequestCollectif,
  canRequestResponsibility,
  canReviewAccounts,
  canReviewCollectifs,
  canSeeFullAddress,
  canStoreItemsIn,
} from './permissions.ts'

function user(overrides: Partial<CurrentUser> = {}): CurrentUser {
  return {
    id: 'u1',
    name: 'U',
    email: 'u@x.org',
    status: 'active',
    isAdmin: false,
    managedCollectifIds: new Set(),
    ...overrides,
  }
}

describe('permissions: accounts', () => {
  it('"Approve or reject an account": admin yes, validated user no, visitor no', () => {
    assert.equal(canReviewAccounts(user({ isAdmin: true })), true)
    assert.equal(canReviewAccounts(user()), false)
    assert.equal(canReviewAccounts(null), false)
    assert.equal(canReviewAccounts(user({ isAdmin: true, status: 'pending' })), false)
  })

  it('"Manage own profile": validated users only', () => {
    assert.equal(canEditOwnProfile(user()), true)
    assert.equal(canEditOwnProfile(user({ status: 'pending' })), false)
    assert.equal(canEditOwnProfile(null), false)
  })

  it('"Disable an account": admin only, never their own account', () => {
    assert.equal(canDisableAccount(user({ isAdmin: true }), 'u2'), true)
    assert.equal(canDisableAccount(user({ isAdmin: true }), 'u1'), false)
    assert.equal(canDisableAccount(user(), 'u2'), false)
    assert.equal(canDisableAccount(null, 'u2'), false)
  })

  it('"Request a new collectif": any validated user, admin included', () => {
    assert.equal(canRequestCollectif(user()), true)
    assert.equal(canRequestCollectif(user({ isAdmin: true })), true)
    assert.equal(canRequestCollectif(user({ status: 'pending' })), false)
    assert.equal(canRequestCollectif(null), false)
  })

  it('"Approve or reject a collectif": admin only', () => {
    assert.equal(canReviewCollectifs(user({ isAdmin: true })), true)
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

  it('"Approve, reject or remove a responsible of C": admin only, not a responsible of C', () => {
    assert.equal(canManageResponsibles(user({ isAdmin: true })), true)
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
})
