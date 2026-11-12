// Reading quantities and amounts as French spreadsheets write them (ADR 0026). Pure functions.
// When a cell could mean two numbers, it is refused rather than guessed: a wrong amount is worse
// than a question.

/** A parsed cell: blank, a value, or not readable. */
export type CellParse<value> = { blank: true } | { blank: false; value: value } | null

/**
 * Full-width digits and separators, as some keyboards type them, become ordinary ones. Nothing
 * else is normalised: NFKC would also turn « 150² » or « ① » into digits.
 */
function narrow(text: string): string {
  return text
    .replace(/[０-９]/g, (digit) => String(digit.charCodeAt(0) - 0xff10))
    .replaceAll('，', ',')
    .replaceAll('．', '.')
}

/** Spaces a spreadsheet may put between groups of digits: normal, no-break, narrow, thin. */
const groupSpace = /[    ]/g

/**
 * The digits of a number written in groups of three, with one kind of separator (« 1 000 »,
 * « 1.000 », « 1'000 »), or null when it is not written so.
 */
function groupedDigits(text: string): string | null {
  // The first group never starts with 0: « 0,500 » is not five hundred.
  const match = /^([1-9]\d{0,2})(?:([ .,'’])\d{3})(?:\2\d{3})*$/.exec(text)
  return match ? text.replace(/\D/g, '') : null
}

/**
 * A quantity: a whole number of at least 1, possibly written « x2 », « 2 pcs », « 1 000 »,
 * « 1.000 » or « 2,0 ». Blank is reported as such: 1 on creation, unchanged on update. Null when
 * unreadable, or when it could be read two ways (« 1 2 »).
 */
export function parseQuantity(cell: string): CellParse<number> {
  const trimmed = narrow(cell).replace(groupSpace, ' ').trim()
  if (trimmed === '') return { blank: true }
  // No real quantity is this long; a cap before any pattern keeps hostile cells cheap.
  if (trimmed.length > maxNumberCell) return null
  const unit = /^[x×]?\s*(.+?)\s*(?:[x×]|pcs?\.?|pi[eè]ces?|u\.?|unit[eé]s?|ex\.?)?$/i.exec(trimmed)
  const core = unit?.[1] ?? ''
  let digits: string | null = null
  if (/^\d+$/.test(core)) digits = core
  // « 2,0 » or « 2.00 »: a whole number written with decimals; « 2.000 » is two thousand.
  else if (/^\d+[.,]0{1,2}$/.test(core)) digits = core.replace(/[.,]0+$/, '')
  else digits = groupedDigits(core)
  if (digits === null || digits.length > 6) return null
  const value = Number(digits)
  return value >= 1 ? { blank: false, value } : null
}

/** Longest number cell read; beyond, it is not a number (and patterns stay cheap). */
const maxNumberCell = 40

/**
 * Currency words and tax marks that may come before or after an amount, never inside it. A dot
 * after a leading word is only taken before a space: « EUR.50 » is fifty cents.
 */
const currencyEdge =
  /^(?:€|eur(?:os?)?|ttc|h\.?\s?t)(?:\.(?=\s|$))?\s*|\s*(?:€|eur(?:os?)?\.?|ttc|h\.?\s?t\.?|,-)$/i

/**
 * An amount in euros, as the item form stores it: « 1 250,50 € », « 1.250,50 », « 1,250.50 »,
 * « 12 EUR », « 0,5 ». The last of `.` and `,` is the decimal separator when both appear; alone
 * and once, it is decimal before one or two digits and a thousands separator before exactly three
 * (« 1,250 »), but not after a zero (« 0,500 » is refused). Digits are never joined across a
 * space or a currency word that does not separate groups of three (« 12 € 50 » is refused).
 * Negative and bracketed amounts are refused too.
 */
export function parseEuros(cell: string): CellParse<number> {
  let text = narrow(cell).replace(groupSpace, ' ').trim()
  if (text === '') return { blank: true }
  if (text.length > maxNumberCell) return null
  // Currency words and tax marks at either end, as many as there are: « 150 € HT ».
  for (let previous = ''; previous !== text; ) {
    previous = text
    text = text.replace(currencyEdge, '').trim()
  }
  if (!/^[\d.,' ’]+$/.test(text) || !/\d/.test(text)) return null

  // Spaces and apostrophes only between groups of three; the decimals after them.
  if (/[ '’]/.test(text)) {
    const grouped = /^([1-9]\d{0,2}(?:[ '’]\d{3})+)([.,]\d{1,2})?$/.exec(text)
    if (!grouped) return null
    text = `${(grouped[1] ?? '').replace(/\D/g, '')}${grouped[2] ?? ''}`
  }

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
      } else if (after.length === 3 && /^[1-9]\d{0,2}$/.test(before)) integer = before + after
      else return null
    }
  } else integer = text

  if (integer === '') integer = '0'
  if (!/^\d+$/.test(integer) || !/^\d{0,2}$/.test(decimals)) return null
  const whole = integer.replace(/^0+(?=\d)/, '')
  const normalised = decimals === '' ? whole : `${whole}.${decimals}`
  // The item form's rule: up to 9 999 999,99.
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(normalised)) return null
  return { blank: false, value: Number(normalised) }
}

/** True when `text` is digits in groups of three after the first, joined by `separator`. */
function groupsOfThree(text: string, separator: string): boolean {
  const [first = '', ...rest] = text.split(separator)
  return /^[1-9]\d{0,2}$/.test(first) && rest.every((group) => /^\d{3}$/.test(group))
}
