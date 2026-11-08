import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import type { CurrentUser } from './middleware/current-user.ts'
import { canDisableAccount, canEditOwnProfile, canReviewAccounts } from './permissions.ts'

function user(overrides: Partial<CurrentUser> = {}): CurrentUser {
  return { id: 'u1', name: 'U', email: 'u@x.org', status: 'active', isAdmin: false, ...overrides }
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
})
