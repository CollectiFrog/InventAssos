import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import type { CurrentUser } from './middleware/current-user.ts'
import { canReviewAccounts } from './permissions.ts'

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
})
