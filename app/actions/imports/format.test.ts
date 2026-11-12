import { readFile } from 'node:fs/promises'
import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { toCsv } from '../../csv.ts'
import type { Item } from '../../data/tables.ts'
import { formatValueCell, inventoryHeaderRow, inventoryRow } from './format.ts'

describe('inventory file format (ADR 0026)', () => {
  it('ships an empty model file that is exactly the export header', async () => {
    const model = await readFile(
      new URL('../../../public/modele-import.csv', import.meta.url),
      'utf8',
    )
    assert.equal(model, toCsv([inventoryHeaderRow()]))
  })

  it('writes values as a French spreadsheet reads them', () => {
    assert.equal(formatValueCell(null), '')
    assert.equal(formatValueCell('150.5' as unknown as Item['estimated_value']), '150,50')
    assert.equal(formatValueCell(1250 as unknown as Item['estimated_value']), '1250,00')
  })

  it('writes one cell per column, labels instead of keys, the location name only', () => {
    const item = {
      id: '00000000-0000-4000-8000-000000000001',
      ref: 'AMP-01',
      name: 'Ampli',
      quantity: 2,
      brand: null,
      model: 'X',
      serial_number: null,
      condition: 'repair',
      estimated_value: '99.9',
      description: 'deux\nlignes',
    } as unknown as Item
    const row = inventoryRow({ item, categoryName: 'Son', locationName: 'Local' })
    assert.deepEqual(row, [
      'AMP-01',
      'Ampli',
      'Son',
      '2',
      '',
      'X',
      '',
      'À réparer',
      '99,90',
      'deux\nlignes',
      'Local',
      '00000000-0000-4000-8000-000000000001',
    ])
    assert.equal(row.length, inventoryHeaderRow().length)
  })
})
