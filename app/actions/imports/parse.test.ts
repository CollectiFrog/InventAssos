import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { parseEuros, parseQuantity } from './parse.ts'

const value = <v>(result: { blank: boolean; value?: v } | null) =>
  result === null ? 'invalid' : result.blank ? 'blank' : (result as { value: v }).value

describe('reading quantities and amounts (ADR 0026)', () => {
  it('reads quantities as people write them', () => {
    for (const [cell, expected] of [
      ['2', 2],
      ['x2', 2],
      ['2x', 2],
      ['2 pcs', 2],
      ['3 pièces', 3],
      ['1 000', 1000],
      ['1 000', 1000],
      ['2,0', 2],
      ['２', 2],
      ['', 'blank'],
      ['  ', 'blank'],
    ] as const) {
      assert.equal(value(parseQuantity(cell)), expected, cell)
    }
  })

  it('refuses quantities that are not a whole number of at least 1', () => {
    for (const cell of ['0', '-1', '2,5', 'deux', '1234567', '1e3']) {
      assert.equal(parseQuantity(cell), null, cell)
    }
  })

  it('reads amounts in French and English notations', () => {
    for (const [cell, expected] of [
      ['1 250,50 €', 1250.5],
      ['1 250,50 €', 1250.5],
      ['1.250,50', 1250.5],
      ['1,250.50', 1250.5],
      ['1,250', 1250],
      ['1.250', 1250],
      ['12,5', 12.5],
      ['12 EUR', 12],
      ['€12', 12],
      ['150 euros TTC', 150],
      ["1'250.50", 1250.5],
      ['0,99', 0.99],
      ['', 'blank'],
    ] as const) {
      assert.equal(value(parseEuros(cell)), expected, cell)
    }
  })

  it('refuses negative, bracketed, ambiguous and oversized amounts', () => {
    for (const cell of ['-5', '(5)', '1,2,3', '12,', 'abc', '12345678', '1.2.3,4', '12,345,6']) {
      assert.equal(parseEuros(cell), null, cell)
    }
  })
})
