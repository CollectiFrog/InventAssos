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

  it('reads thousands in quantities as amounts do, and never joins separate numbers', () => {
    for (const [cell, expected] of [
      ['2.000', 2000],
      ['1,000', 1000],
      ['10,000 pcs', 10000],
      ['2,00', 2],
    ] as const) {
      assert.equal(value(parseQuantity(cell)), expected, cell)
    }
    for (const cell of ['1 2', '3\n4', '2²', '①', '1.0000']) {
      assert.equal(parseQuantity(cell), null, cell)
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

  it('never joins digits across a space or a currency word: refused, not 100 times too much', () => {
    for (const cell of [
      '12€50',
      '12 € 50',
      '12 euros 50',
      '10 20',
      '1 2500',
      "1'2",
      '1\n250',
      '12 5',
    ]) {
      assert.equal(parseEuros(cell), null, cell)
    }
  })

  it('reads a group of three after zero as decimals it cannot be: refused', () => {
    for (const cell of ['0,125', '0,500', '0.500', '0 500', "00'100", '01 121']) {
      assert.equal(parseEuros(cell), null, cell)
      assert.equal(parseQuantity(cell), null, cell)
    }
    assert.equal(parseQuantity('0.001'), null)
  })

  it('reads the singular « euro », and a leading word before a decimal point', () => {
    for (const [cell, expected] of [
      ['150 euro', 150],
      ['1 euro', 1],
      ['150 EURO', 150],
      ['EUR.50', 0.5],
      ['ht.5', 0.5],
      ['H.T. 150', 150],
    ] as const) {
      assert.equal(value(parseEuros(cell)), expected, cell)
    }
  })

  it('stays fast on a hostile cell', () => {
    for (const cell of [
      `1${' '.repeat(1_000_000)}1`,
      `1${',-'.repeat(500_000)}`,
      `€${'1'.repeat(1_000_000)}€`,
    ]) {
      const started = performance.now()
      assert.equal(parseEuros(cell), null)
      assert.equal(parseQuantity(cell), null)
      assert.ok(performance.now() - started < 200, `${performance.now() - started} ms`)
    }
  })

  it('reads currency words glued to the amount, and refuses superscripts', () => {
    for (const [cell, expected] of [
      ['12EUR', 12],
      ['150ht', 150],
      ['EUR12', 12],
      ['12 Eur.', 12],
      ['150 € H.T.', 150],
      ['150,-', 150],
      ['１２，５０', 12.5],
      ['100 200', 100200],
    ] as const) {
      assert.equal(value(parseEuros(cell)), expected, cell)
    }
    for (const cell of ['150²', '①', '100¹']) assert.equal(parseEuros(cell), null, cell)
  })
})
