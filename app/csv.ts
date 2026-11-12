// CSV as spreadsheets write it and read it (ADR 0026): no dependency, so that hostile uploads are
// parsed by code we test. Used by the import (US-0.10.1) and the export (US-0.10.4).

/** A parsed file: its separator and its rows of cells, blank lines dropped. */
export interface CsvTable {
  delimiter: ';' | ',' | '\t'
  rows: string[][]
}

/** Thrown when the bytes are not a readable CSV; the message is shown to the user, in French. */
export class CsvError extends Error {}

const windows1252 = new TextDecoder('windows-1252')
const utf8 = new TextDecoder('utf-8', { fatal: true })

/**
 * Decodes an uploaded file: UTF-8 (with or without BOM), else Windows-1252, which spreadsheets on
 * Windows still write and which decodes any byte.
 */
export function decodeCsv(bytes: Uint8Array): string {
  if (bytes.includes(0)) throw new CsvError('Ce fichier n’est pas un CSV (fichier binaire).')
  try {
    return utf8.decode(bytes).replace(/^﻿/, '')
  } catch {
    return windows1252.decode(bytes)
  }
}

/** The separator of the first line: the most frequent of `;`, `,` and tab outside quotes. */
function detectDelimiter(text: string): CsvTable['delimiter'] {
  const counts = { ';': 0, ',': 0, '\t': 0 }
  let quoted = false
  for (const character of text) {
    if (character === '"') quoted = !quoted
    else if (!quoted && (character === '\n' || character === '\r')) break
    else if (!quoted && (character === ';' || character === ',' || character === '\t')) {
      counts[character]++
    }
  }
  if (counts[';'] >= counts[','] && counts[';'] >= counts['\t'] && counts[';'] > 0) return ';'
  return counts['\t'] > counts[','] ? '\t' : ','
}

/**
 * Parses CSV text (RFC 4180, with `;`, `,` or tab): quoted fields may hold separators, line breaks
 * and doubled quotes. Cells are trimmed; lines with only blank cells are dropped.
 */
export function parseCsv(text: string): CsvTable {
  const delimiter = detectDelimiter(text)
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  let wasQuoted = false

  const endCell = () => {
    row.push(wasQuoted ? cell : cell.trim())
    cell = ''
    wasQuoted = false
  }
  const endRow = () => {
    endCell()
    if (row.some((value) => value !== '')) rows.push(row)
    row = []
  }

  for (let index = 0; index < text.length; index++) {
    const character = text[index]
    if (quoted) {
      if (character !== '"') cell += character
      else if (text[index + 1] === '"') {
        cell += '"'
        index++
      } else quoted = false
    } else if (character === '"' && cell.trim() === '') {
      // An opening quote, possibly after spaces; a quote inside a bare cell stays a character.
      cell = ''
      quoted = true
      wasQuoted = true
    } else if (character === delimiter) endCell()
    else if (character === '\n') endRow()
    else if (character === '\r') {
      if (text[index + 1] === '\n') index++
      endRow()
    } else cell += character
  }
  if (quoted) throw new CsvError('Ce fichier CSV est mal formé : un guillemet n’est pas fermé.')
  if (cell !== '' || row.length > 0) endRow()
  return { delimiter, rows: rows.map((cells) => cells.map((value) => value.trim())) }
}

/** Characters that make a spreadsheet run a cell as a formula (CSV injection). */
const formulaStarts = new Set(['=', '+', '-', '@', '\t', '\r'])

/**
 * Makes a value inert in a spreadsheet: a leading apostrophe before anything that would start a
 * formula. A plain number keeps its sign, since it cannot run anything.
 */
export function neutralizeFormula(value: string): string {
  if (!formulaStarts.has(value.charAt(0))) return value
  return /^[+-]?\d+([.,]\d+)?$/.test(value) ? value : `'${value}`
}

/** Undoes `neutralizeFormula` when a file we exported comes back. */
export function restoreNeutralized(value: string): string {
  return value.startsWith("'") && formulaStarts.has(value.charAt(1)) ? value.slice(1) : value
}

/**
 * Writes rows as CSV for spreadsheets: `;`, CRLF and a BOM so that Excel in French opens it with
 * its accents; every cell is neutralised against formulas.
 */
export function toCsv(rows: readonly (readonly string[])[]): string {
  const lines = rows.map((cells) =>
    cells
      .map((cell) => {
        const value = neutralizeFormula(cell)
        return /[";\r\n]/.test(value) || value !== value.trim()
          ? `"${value.replaceAll('"', '""')}"`
          : value
      })
      .join(';'),
  )
  return `﻿${lines.join('\r\n')}\r\n`
}
