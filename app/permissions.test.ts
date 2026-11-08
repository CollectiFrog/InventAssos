import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import type { CurrentUser } from './middleware/current-user.ts'
import {
  canDisableAccount,
  canEditCollectif,
  canEditOwnProfile,
  canManageResponsibles,
  canRequestCollectif,
  canRequestResponsibility,
  canReviewAccounts,
  canReviewCollectifs,
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
})
