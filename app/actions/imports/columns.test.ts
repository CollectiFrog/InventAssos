import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { exactSynonymKeys, guessColumns, headerKey } from './columns.ts'
import { inventoryHeaderRow } from './format.ts'

const fields = (headers: string[], saved?: Record<string, string>) =>
  guessColumns(headers, saved).map((guess) => guess.field)

describe('guessing columns from their titles (ADR 0026)', () => {
  it('builds the same key from different spellings', () => {
    assert.equal(headerKey('N° de série'), headerKey('numéro série'))
    assert.equal(headerKey('S/N'), headerKey('Série'))
    assert.equal(headerKey('Valeur estimée (€)'), headerKey('valeur estimee'))
    assert.equal(headerKey('Qté'), headerKey('Quantité'))
    assert.equal(headerKey('Remarques'), headerKey('remarque'))
    assert.equal(headerKey('Prix'), 'prix')
  })

  it('maps every column of our own export', () => {
    const header = inventoryHeaderRow()
    assert.deepEqual(fields(header), [
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
    ])
  })

  it('recognises common spreadsheet titles, French and English', () => {
    assert.deepEqual(
      fields(['Désignation', 'Qté', 'Famille', 'Fabricant', 'S/N', 'Prix d’achat', 'Emplacement']),
      ['name', 'quantity', 'category', 'brand', 'serialNumber', 'estimatedValue', 'location'],
    )
    assert.deepEqual(fields(['Item name', 'Qty', 'Category', 'Notes']), [
      'name',
      'quantity',
      'category',
      'description',
    ])
  })

  it('settles the designed conflicts', () => {
    assert.deepEqual(fields(['Nom', 'Nom du lieu']), ['name', 'location'])
    assert.deepEqual(fields(['Nom du lieu', 'Nom']), ['location', 'name'])
    assert.deepEqual(fields(['Réf. constructeur', 'Réf']), ['model', 'ref'])
    assert.deepEqual(fields(['Nom', 'Prix de location', 'Date d’achat', 'Nom du propriétaire']), [
      'name',
      null,
      null,
      null,
    ])
    assert.deepEqual(fields(['Statut', 'Status']), [null, null])
  })

  it('prefers our own titles to other synonyms, wherever they sit', () => {
    assert.deepEqual(fields(['N°', 'Référence', 'Nom']), [null, 'ref', 'name'])
    assert.deepEqual(fields(['Type', 'Catégorie']), [null, 'category'])
    assert.deepEqual(fields(['Stock', 'Quantité']), [null, 'quantity'])
    assert.deepEqual(fields(['Local', 'Lieu']), [null, 'location'])
  })

  it('blocks totals, loans and family names from « contains » matches', () => {
    assert.deepEqual(fields(['Nom de famille', 'Prix total', 'Prix unitaire HT']), [
      null,
      null,
      'estimatedValue',
    ])
  })

  it('stays fast on a hostile title and ignores inherited keys', () => {
    const started = performance.now()
    headerKey('('.repeat(200_000))
    assert.ok(performance.now() - started < 200)
    assert.equal(headerKey('Constructor'), 'constructor')
    assert.deepEqual(fields(['__proto__', 'constructor']), [null, null])
  })

  it('uses each field once, the first column winning, and skips blank titles', () => {
    assert.deepEqual(fields(['Nom', 'Désignation', '', 'Nom']), ['name', null, null, null])
  })

  it('puts the owner’s saved choice first', () => {
    const saved = { [headerKey('Truc')]: 'name', [headerKey('Nom')]: 'description' }
    assert.deepEqual(fields(['Nom', 'Truc'], saved), ['description', 'name'])
    assert.deepEqual(fields(['Machin'], { machin: 'notAField' }), [null])
  })

  it('keeps every synonym distinct after normalisation', () => {
    // The module throws at load if one key named two fields. Many spellings fold together
    // (« réf », « réf. », « référence »), so there are fewer keys than titles.
    assert.ok(exactSynonymKeys().size > 120)
    assert.equal(exactSynonymKeys().get(headerKey('Identifiant')), 'id')
  })
})
