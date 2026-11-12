import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import {
  CsvError,
  decodeCsv,
  neutralizeFormula,
  parseCsv,
  restoreNeutralized,
  toCsv,
} from './csv.ts'

const bytes = (text: string) => new TextEncoder().encode(text)

describe('CSV (ADR 0026)', () => {
  it('reads `;` as French spreadsheets write it, and `,` and tabs', () => {
    assert.deepEqual(parseCsv('Nom;Qté\r\nConsole;2\r\n'), {
      delimiter: ';',
      rows: [
        ['Nom', 'Qté'],
        ['Console', '2'],
      ],
      numbers: [1, 2],
    })
    assert.equal(parseCsv('Nom,Qté\nConsole,2').delimiter, ',')
    assert.deepEqual(parseCsv('Nom\tQté\nConsole\t2').rows[1], ['Console', '2'])
  })

  it('prefers `;` when a line holds decimal commas', () => {
    assert.deepEqual(parseCsv('Nom;Valeur\nAmpli;150,50').rows[1], ['Ampli', '150,50'])
  })

  it('keeps separators, quotes and line breaks inside quoted fields', () => {
    const table = parseCsv('Nom;Description\n"Câble; 10 m";"Dit ""le long""\nsur deux lignes"\n')
    assert.deepEqual(table.rows[1], ['Câble; 10 m', 'Dit "le long"\nsur deux lignes'])
  })

  it('trims cells, drops blank lines and keeps short rows as they are', () => {
    const table = parseCsv('Nom ; Qté\n\n ;\n  Micro  ;1\nPied\n')
    assert.deepEqual(table.rows, [['Nom', 'Qté'], ['Micro', '1'], ['Pied']])
  })

  it('keeps a quote that is not at the start of a cell', () => {
    assert.deepEqual(parseCsv('Nom\nÉcran 24" LED').rows[1], ['Écran 24" LED'])
  })

  it('refuses an unclosed quote and a binary file, in French', () => {
    assert.throws(() => parseCsv('Nom\n"jamais fermé'), CsvError)
    assert.throws(() => decodeCsv(new Uint8Array([80, 75, 3, 4, 0, 0])), /binaire/)
  })

  it('decodes UTF-8 with or without BOM, and Windows-1252', () => {
    assert.equal(decodeCsv(bytes('﻿Éclairage')), 'Éclairage')
    assert.equal(decodeCsv(bytes('Éclairage')), 'Éclairage')
    assert.equal(decodeCsv(new Uint8Array([0xc9, 0x63, 0x6c, 0x61, 0x69, 0x72])), 'Éclair')
  })

  it('makes formulas inert in exports, and numbers stay numbers', () => {
    assert.equal(neutralizeFormula('=HYPERLINK("http://x")'), '\'=HYPERLINK("http://x")')
    assert.equal(neutralizeFormula('+33 6 12'), "'+33 6 12")
    assert.equal(neutralizeFormula('@cmd'), "'@cmd")
    assert.equal(neutralizeFormula('-3'), '-3')
    assert.equal(neutralizeFormula('-3+cmd'), "'-3+cmd")
    assert.equal(neutralizeFormula('Console'), 'Console')
    assert.equal(restoreNeutralized("'=1+1"), '=1+1')
    assert.equal(restoreNeutralized("'Console"), "'Console")
  })

  it('stays linear on a file of quotes, a huge cell or many columns', () => {
    for (const text of [
      `a${'"'.repeat(1_000_000)}`,
      `Nom\n${'x'.repeat(2_000_000)}`,
      `${' '.repeat(500_000)}"${'y'.repeat(500_000)}"`,
    ]) {
      const started = performance.now()
      parseCsv(text)
      assert.ok(performance.now() - started < 1000, `took ${performance.now() - started} ms`)
    }
  })

  it('stops as soon as a limit is passed, in French', () => {
    const started = performance.now()
    assert.throws(() => parseCsv('a\n'.repeat(1_000_000), { maxRows: 2001 }), /trop de lignes/)
    assert.throws(
      () => parseCsv(`a${';'.repeat(2_000_000)}`, { maxColumns: 50 }),
      /trop de colonnes/,
    )
    assert.ok(performance.now() - started < 1000)
    assert.equal(parseCsv('a\nb\nc', { maxRows: 3 }).rows.length, 3)
  })

  it('numbers rows as the spreadsheet does: blank rows counted, a multi-line cell is one row', () => {
    const table = parseCsv('Nom;Note\n\nMicro;"deux\nlignes"\nPied;x\r\n\r\nCâble;y')
    assert.deepEqual(table.numbers, [1, 3, 4, 6])
    assert.deepEqual(parseCsv('a\n"x\ny"\nb').numbers, [1, 2, 3])
  })

  it('accepts any whitespace before an opening quote, as before', () => {
    assert.deepEqual(parseCsv('Nom;Autre\n\u00a0"a;b";c').rows[1], ['a;b', 'c'])
    assert.deepEqual(parseCsv('\uFEFF"a;b";c').rows[0], ['a;b', 'c'])
  })

  it('drops a blank row wider than the column limit, and still refuses a wide one', () => {
    assert.deepEqual(parseCsv('a;b\n;;;;\nc;d', { maxColumns: 3 }).rows, [
      ['a', 'b'],
      ['c', 'd'],
    ])
    assert.throws(() => parseCsv('a;b\n;;;x', { maxColumns: 3 }), /trop de colonnes/)
  })

  it('skips a `sep=` line ending in CR, spaces or the end of the file', () => {
    assert.deepEqual(parseCsv('sep=; \rNom;Qté').rows, [['Nom', 'Qté']])
    assert.deepEqual(parseCsv('sep=;').rows, [])
  })

  it('skips the `sep=` line Excel writes, and uses its separator', () => {
    const table = parseCsv('sep=,\r\nNom,Valeur\r\nAmpli;rouge,150')
    assert.equal(table.delimiter, ',')
    assert.deepEqual(table.rows, [
      ['Nom', 'Valeur'],
      ['Ampli;rouge', '150'],
    ])
    assert.deepEqual(table.numbers, [2, 3])
  })

  it('writes what it reads back: BOM, `;`, CRLF, quotes where needed', () => {
    const rows = [
      ['Nom', 'Description'],
      ['Câble; 10 m', 'Dit "le long"\nsur deux lignes'],
      ['=SOMME(A1)', ' bord '],
    ]
    const csv = toCsv(rows)
    assert.ok(csv.startsWith('﻿Nom;Description\r\n'))
    const back = parseCsv(decodeCsv(bytes(csv))).rows
    assert.deepEqual(back[1], rows[1])
    assert.deepEqual(back[2]?.map(restoreNeutralized), ['=SOMME(A1)', 'bord'])
  })
})
