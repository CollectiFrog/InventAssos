// Text normalisation for matching what people type in spreadsheets (ADR 0026). Pure functions.

/**
 * Folds a text for comparison: accents and case removed, ligatures spelled out, every run of
 * other characters turned into one space. « Électricité » and « electricite » fold alike.
 */
export function fold(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replaceAll('œ', 'oe')
    .replaceAll('æ', 'ae')
    .replaceAll('ß', 'ss')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/** Strips one final `s` or `x` from a word longer than three letters: « micros » → « micro ». */
export function singular(token: string): string {
  if (token.length <= 3 || token === 'prix') return token
  return /[sx]$/.test(token) ? token.slice(0, -1) : token
}

/** The folded words of a text, each made singular. */
export function words(value: string): string[] {
  const folded = fold(value)
  return folded === '' ? [] : folded.split(' ').map(singular)
}

/** True when `phrase` appears in `tokens` as consecutive whole words. */
export function containsPhrase(tokens: readonly string[], phrase: readonly string[]): boolean {
  if (phrase.length === 0 || phrase.length > tokens.length) return false
  for (let start = 0; start + phrase.length <= tokens.length; start++) {
    if (phrase.every((word, offset) => tokens[start + offset] === word)) return true
  }
  return false
}
