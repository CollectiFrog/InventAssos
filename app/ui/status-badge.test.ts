import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { itemStatusOf } from './status-badge.tsx'

describe('item status badge (guidelines 4.3)', () => {
  it('marks archived items, whatever their condition', () => {
    assert.equal(itemStatusOf({ archivedAt: new Date(), condition: 'good' }), 'archived')
  })

  it('marks items to repair or out of order', () => {
    assert.equal(itemStatusOf({ archivedAt: null, condition: 'repair' }), 'broken')
    assert.equal(itemStatusOf({ archivedAt: null, condition: 'broken' }), 'broken')
  })

  it('claims nothing otherwise: without loans the app cannot say an item is available', () => {
    assert.equal(itemStatusOf({ archivedAt: null, condition: 'good' }), null)
    assert.equal(itemStatusOf({ archivedAt: null, condition: null }), null)
  })
})
