// Reading quantities and amounts as French spreadsheets write them (ADR 0026). Pure functions.

/** Every kind of space a spreadsheet may put in a number: normal, no-break, narrow, thin. */
const spaces = /[\s   ]/g

/** A parsed cell: blank, a value, or not readable. */
export type CellParse<value> = { blank: true } | { blank: false; value: value } | null

/**
 * A quantity: a whole number of at least 1, possibly written « x2 », « 2 pcs », « 1 000 » or
 * « 2,0 ». Blank is reported as such: 1 on creation, unchanged on update. Null when unreadable.
 */
export function parseQuantity(cell: string): CellParse<number> {
  const text = cell.normalize('NFKC').replace(spaces, '')
  if (text === '') return { blank: true }
  const match =
    /^[x×]?(\d{1,6})(?:[.,]0+)?(?:[x×]|pcs?\.?|pi[eè]ces?|u\.?|unit[eé]s?|ex\.?)?$/i.exec(text)
  const value = match ? Number(match[1]) : 0
  return value >= 1 ? { blank: false, value } : null
}

/**
 * An amount in euros, as the item form stores it: « 1 250,50 € », « 1.250,50 », « 1,250.50 »,
 * « 12 EUR ». The last of `.` and `,` is the decimal separator when both appear; alone and once, it
 * is decimal before one or two digits and a thousands separator before exactly three. Negative,
 * bracketed and ambiguous amounts are unreadable (null).
 */
export function parseEuros(cell: string): CellParse<number> {
  const text = cell
    .normalize('NFKC')
    .replace(/€|\b(?:eur|euros?|ttc|ht)\b/gi, '')
    .replace(spaces, '')
    .replace(/['’]/g, '')
  if (cell.trim() === '') return { blank: true }
  if (!/^[\d.,]+$/.test(text) || !/\d/.test(text)) return null

  const lastDot = text.lastIndexOf('.')
  const lastComma = text.lastIndexOf(',')
  let integer: string
  let decimals = ''
  if (lastDot >= 0 && lastComma >= 0) {
    const decimalAt = Math.max(lastDot, lastComma)
    const grouping = lastDot > lastComma ? ',' : '.'
    integer = text.slice(0, decimalAt)
    decimals = text.slice(decimalAt + 1)
    if (integer.includes(lastDot > lastComma ? '.' : ',')) return null
    if (!groupsOfThree(integer, grouping)) return null
    integer = integer.replaceAll(grouping, '')
  } else if (lastDot >= 0 || lastComma >= 0) {
    const separator = lastDot >= 0 ? '.' : ','
    const parts = text.split(separator)
    if (parts.length > 2) {
      if (!groupsOfThree(text, separator)) return null
      integer = parts.join('')
    } else {
      const [before = '', after = ''] = parts
      if (after.length === 1 || after.length === 2) {
        integer = before
        decimals = after
      } else if (after.length === 3 && before !== '') integer = before + after
      else return null
    }
  } else integer = text

  if (integer === '') integer = '0'
  if (!/^\d+$/.test(integer) || !/^\d{0,2}$/.test(decimals)) return null
  const normalised =
    decimals === ''
      ? integer.replace(/^0+(?=\d)/, '')
      : `${integer.replace(/^0+(?=\d)/, '')}.${decimals}`
  // The item form's rule: up to 9 999 999,99.
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(normalised)) return null
  return { blank: false, value: Number(normalised) }
}

/** True when `text` is digits in groups of three after the first, joined by `separator`. */
function groupsOfThree(text: string, separator: string): boolean {
  const [first = '', ...rest] = text.split(separator)
  return /^\d{1,3}$/.test(first) && rest.every((group) => /^\d{3}$/.test(group))
}
