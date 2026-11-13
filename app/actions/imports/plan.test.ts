import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { fold } from './fold.ts'
import { inventoryHeaderRow } from './format.ts'
import {
  type ColumnMapping,
  type ExistingItem,
  type ImportWorld,
  normaliseRef,
  planImport,
  type ValueMapping,
} from './plan.ts'

const ampId = '00000000-0000-4000-8000-000000000001'
const soldId = '00000000-0000-4000-8000-000000000002'
const lockedId = '00000000-0000-4000-8000-000000000003'

const existing = (overrides: Partial<ExistingItem>): ExistingItem => ({
  id: ampId,
  ref: 'AMP-01',
  name: 'Ampli',
  categoryId: 'sound',
  quantity: 1,
  brand: 'Yamaha',
  model: null,
  serialNumber: null,
  condition: 'good',
  estimatedValue: '150.00',
  description: 'Gris',
  locationId: 'local',
  locationName: 'Local',
  archived: false,
  changeable: true,
  ...overrides,
})

const amp = existing({})
const sold = existing({ id: soldId, ref: 'OLD-1', name: 'Vieux pied', archived: true })
const locked = existing({ id: lockedId, ref: 'LOCK-1', name: 'Câble', changeable: false })

/** The database's view, as the loader builds it; references folded like `inv_fold`. */
function world(refs: string[], options: { maySetRef?: boolean } = {}): ImportWorld {
  const items = [amp, sold, locked]
  return {
    defaultLocation: { id: 'local', name: 'Local' },
    locations: [
      { id: 'local', name: 'Local' },
      { id: 'cave', name: 'Cave' },
    ],
    categories: [
      { id: 'sound', name: 'Son', position: 0 },
      { id: 'lighting', name: 'Lumière', position: 1 },
      { id: 'other', name: 'Autre', position: 2 },
    ],
    refs: new Map(
      refs.map((ref) => {
        const key = fold(normaliseRef(ref))
        return [
          normaliseRef(ref),
          { key, item: items.find((i) => fold(i.ref ?? '') === key) ?? null },
        ]
      }),
    ),
    itemsById: new Map(items.map((item) => [item.id, item])),
    namesByLocation: new Map([['local', new Set(['ampli', 'cable'])]]),
    maySetRef: options.maySetRef ?? true,
  }
}

const header = inventoryHeaderRow()
const columns: ColumnMapping = [
  'ref',
  'name',
  'category',
  'quantity',
  'brand',
  'model',
  'serialNumber',
  'condition',
  'estimatedValue',
  'description',
  'location',
  'id',
]
const noValues: ValueMapping = { category: {}, condition: {}, location: {} }

/** A row from named cells, the others blank, in the export's column order. */
function row(n: number, cells: Partial<Record<(typeof columns)[number] & string, string>>) {
  return { n, cells: columns.map((field) => (field ? (cells[field] ?? '') : '')) }
}

function plan(
  rows: ReturnType<typeof row>[],
  options: {
    values?: ValueMapping
    forced?: number[]
    mapping?: ColumnMapping
    maySetRef?: boolean
  } = {},
) {
  const refs = rows.map((r) => r.cells[0] ?? '').filter((ref) => ref.trim() !== '')
  return planImport(
    { header, rows },
    options.mapping ?? columns,
    options.values ?? noValues,
    world(refs, { maySetRef: options.maySetRef }),
    new Set(options.forced ?? []),
  )
}

describe('planning an import, row by row (US-0.10.2, ADR 0027)', () => {
  it('creates a row without reference, with defaults: quantity 1, the import’s location', () => {
    const result = plan([row(2, { name: 'Lyre', category: 'Lumière' })])
    const [created] = result.rows
    assert.equal(created?.state, 'create')
    assert.equal(created?.fields?.quantity, 1)
    assert.equal(created?.fields?.categoryId, 'lighting')
    assert.equal(created?.locationId, 'local')
    assert.equal(result.confirmable, true)
  })

  it('updates the item a reference names, only with non-blank cells (blank keeps)', () => {
    const [updated] = plan([row(2, { ref: 'amp-01', quantity: '3', brand: '' })]).rows
    assert.equal(updated?.state, 'update')
    assert.equal(updated?.itemId, ampId)
    assert.deepEqual(updated?.changed, ['quantity'])
    assert.equal(updated?.fields?.brand, 'Yamaha')
    // Found by its reference, the item keeps the stored spelling.
    assert.equal(updated?.fields?.ref, 'AMP-01')
  })

  it('leaves an item unchanged when nothing differs', () => {
    const [same] = plan([row(2, { ref: 'AMP-01', name: 'Ampli', estimatedValue: '150,00' })]).rows
    assert.equal(same?.state, 'unchanged')
  })

  it('updates through the Identifiant column, and may give a reference', () => {
    const [updated] = plan([row(2, { id: ampId.toUpperCase(), ref: 'AMP-02' })]).rows
    assert.equal(updated?.state, 'update')
    assert.deepEqual(updated?.changed, ['ref'])
    assert.equal(updated?.fields?.ref, 'AMP-02')
  })

  it('refuses an unknown Identifiant, and a reference held by another item', () => {
    const [unknown] = plan([row(2, { id: '00000000-0000-4000-8000-00000000ffff' })]).rows
    assert.deepEqual(unknown?.errors, ['Identifiant inconnu pour ce propriétaire.'])
    const [clash] = plan([row(2, { id: ampId, ref: 'LOCK-1' })]).rows
    assert.match(clash?.errors.join(' ') ?? '', /déjà celle d’un autre objet/)
  })

  it('refuses a reference twice in the file, case and accents ignored, on every row', () => {
    const result = plan([
      row(2, { ref: 'Été-1', name: 'A' }),
      row(3, { ref: 'ete-1', name: 'B' }),
      row(4, { ref: 'X-9', name: 'C' }),
    ])
    assert.deepEqual(
      result.rows.map((r) => r.state),
      ['invalid', 'invalid', 'create'],
    )
    assert.match(result.rows[0]?.errors[0] ?? '', /aussi ligne 3/)
    assert.equal(result.confirmable, false)
  })

  it('sets an archived item’s row aside, unless the person adds it as a new item', () => {
    const [aside] = plan([row(2, { ref: 'OLD-1', name: 'Vieux pied' })]).rows
    assert.equal(aside?.state, 'archived')
    assert.equal(aside?.itemId, soldId)
    const [forced] = plan([row(2, { ref: 'OLD-1', name: 'Vieux pied' })], { forced: [2] }).rows
    assert.equal(forced?.state, 'create')
    assert.equal(forced?.fields?.ref, null)
    assert.match(forced?.warnings[0] ?? '', /garde la sienne/)
  })

  it('refuses to change an item the person may not change', () => {
    const [refused] = plan([row(2, { ref: 'LOCK-1', quantity: '2' })]).rows
    assert.equal(refused?.state, 'invalid')
    assert.deepEqual(refused?.errors, ['Vous ne pouvez pas modifier cet objet.'])
  })

  it('reports each unreadable cell in French, prefixed by its field', () => {
    const [bad] = plan([
      row(2, { name: '', quantity: 'deux', estimatedValue: 'beaucoup', brand: 'x'.repeat(121) }),
    ]).rows
    assert.equal(bad?.state, 'invalid')
    const text = bad?.errors.join(' | ') ?? ''
    assert.match(text, /Quantité « deux » : indiquez un nombre entier/)
    assert.match(text, /Valeur « beaucoup » : montant non reconnu/)
    assert.match(text, /Nom manquant\./)
    assert.match(text, /Marque : 120 caractères au maximum\./)
  })

  it('refuses a row longer than the titles, but not a trailing empty cell', () => {
    const extra = { n: 2, cells: [...row(2, { name: 'A' }).cells, 'décalé'] }
    assert.match(plan([extra]).rows[0]?.errors[0] ?? '', /plus de cellules que la ligne de titres/)
    const trailing = { n: 2, cells: [...row(2, { name: 'A' }).cells, ' '] }
    assert.equal(plan([trailing]).rows[0]?.state, 'create')
  })

  it('moves an item only to a different location named in the file', () => {
    const values: ValueMapping = { ...noValues, location: { cave: 'cave', local: '' } }
    const [moved] = plan([row(2, { ref: 'AMP-01', location: 'Cave' })], { values }).rows
    assert.equal(moved?.state, 'update')
    assert.equal(moved?.locationId, 'cave')
    assert.equal(moved?.fromLocationId, 'local')
    const [stays] = plan([row(2, { ref: 'AMP-01', location: 'LOCAL' })], { values }).rows
    assert.equal(stays?.state, 'unchanged')
    const [here] = plan([row(2, { ref: 'AMP-01', location: 'Grenier' })], { values }).rows
    assert.equal(here?.state, 'unchanged')
  })

  it('uses the chosen category and condition, « Non précisé » keeping an update’s', () => {
    const values: ValueMapping = {
      category: { projo: 'lighting' },
      condition: { nickel: 'new', '?': '' },
      location: {},
    }
    const [created] = plan([row(2, { name: 'P', category: 'Projo', condition: 'Nickel' })], {
      values,
    }).rows
    assert.equal(created?.fields?.categoryId, 'lighting')
    assert.equal(created?.fields?.condition, 'new')
    const [kept] = plan([row(2, { ref: 'AMP-01', condition: '?' })], { values }).rows
    assert.equal(kept?.state, 'unchanged')
  })

  it('warns about a name already in the location, and a name twice in the file', () => {
    const result = plan([
      row(2, { name: 'Ampli' }),
      row(3, { name: 'Pied' }),
      row(4, { name: 'pied' }),
    ])
    assert.match(result.rows[0]?.warnings[0] ?? '', /existe déjà dans ce lieu/)
    assert.deepEqual(result.rows[2]?.warnings, ['Même nom que la ligne 3.'])
    assert.equal(result.counts.warnings, 2)
    assert.equal(result.confirmable, true)
  })

  it('counts every state, moves included, and needs something to write', () => {
    const values: ValueMapping = { ...noValues, location: { cave: 'cave' } }
    const result = plan(
      [
        row(2, { name: 'Neuf' }),
        row(3, { ref: 'AMP-01', location: 'Cave' }),
        row(4, { ref: 'OLD-1' }),
      ],
      { values },
    )
    assert.deepEqual(result.counts, {
      create: 1,
      update: 1,
      moved: 1,
      unchanged: 0,
      archived: 1,
      invalid: 0,
      warnings: 0,
    })
    assert.equal(plan([row(2, { ref: 'AMP-01' })]).confirmable, false)
  })

  it('refuses two rows aimed at one item, by Identifiant and by reference', () => {
    const result = plan([
      row(2, { id: ampId, quantity: '3' }),
      row(3, { ref: 'AMP-01', quantity: '5' }),
    ])
    assert.deepEqual(
      result.rows.map((r) => r.state),
      ['invalid', 'invalid'],
    )
    assert.match(result.rows[0]?.errors[0] ?? '', /aussi visé ligne 3 : une seule ligne par objet/)
    const swap = plan([row(2, { id: ampId, ref: 'NEW-9' }), row(3, { ref: 'AMP-01', name: 'X' })])
    assert.equal(swap.confirmable, false)
  })

  it('cuts long lists of other rows short', () => {
    const rows = Array.from({ length: 12 }, (_, i) => row(i + 2, { ref: 'SAME', name: `N${i}` }))
    const [first] = plan(rows).rows
    assert.match(first?.errors[0] ?? '', /aussi ligne 3, 4, 5, 6, 7 et 6 autres/)
  })

  it('lets only the owner set references (`canSetItemRef`)', () => {
    const created = plan([row(2, { name: 'Lyre', ref: 'L-1' })], { maySetRef: false }).rows[0]
    assert.match(created?.errors.join(' ') ?? '', /seul le propriétaire/)
    const renamed = plan([row(2, { id: ampId, ref: 'AMP-02' })], { maySetRef: false }).rows[0]
    assert.equal(renamed?.state, 'invalid')
    // Finding an item by its reference does not set it: allowed.
    const found = plan([row(2, { ref: 'AMP-01', quantity: '4' })], { maySetRef: false }).rows[0]
    assert.equal(found?.state, 'update')
  })

  it('names the field of a present but invalid name', () => {
    const [long] = plan([row(2, { name: 'x'.repeat(121) })]).rows
    assert.deepEqual(long?.errors, ['Nom : 120 caractères au maximum.'])
  })

  it('keeps an update’s category, value and description when their cells are blank', () => {
    const [same] = plan([
      row(2, { ref: 'AMP-01', category: '', estimatedValue: '', description: '' }),
    ]).rows
    assert.equal(same?.state, 'unchanged')
    assert.equal(same?.fields?.categoryId, 'sound')
    assert.equal(same?.fields?.estimatedValue, 150)
    assert.equal(same?.fields?.description, 'Gris')
  })

  it('adds a forced archived row found by Identifiant without its reference', () => {
    const [forced] = plan([row(2, { id: soldId, name: 'Pied neuf' })], { forced: [2] }).rows
    assert.equal(forced?.state, 'create')
    assert.equal(forced?.fields?.ref, null)
  })

  it('ignores unmapped columns', () => {
    const mapping: ColumnMapping = columns.map((field) => (field === 'brand' ? null : field))
    const [same] = plan([row(2, { ref: 'AMP-01', brand: 'Autre marque' })], { mapping }).rows
    assert.equal(same?.state, 'unchanged')
  })
})
