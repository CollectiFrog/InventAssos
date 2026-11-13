// The values of the category, condition and location columns, and what each stands for
// (US-0.10.1, ADR 0027). Pure: guessed from the owner's saved choices, then editable.
import { fold } from './fold.ts'
import type { ColumnMapping, ValueMapping } from './plan.ts'
import {
  type CategoryChoice,
  guessCategory,
  guessCondition,
  guessLocation,
  type ValueGuessSource,
} from './values.ts'

/** The columns whose values are mapped one by one. */
export const valueKinds = ['category', 'condition', 'location'] as const
export type ValueKind = (typeof valueKinds)[number]

/** Most distinct values a value column may hold: more means the wrong column was chosen. */
export const maxDistinctValues = 100

/** One distinct value of a column: its key, how it is written first, how many rows have it. */
export interface DistinctValue {
  key: string
  label: string
  count: number
}

/** The distinct non-blank values of a column, in order of first appearance. */
export function distinctValues(
  rows: readonly { cells: readonly string[] }[],
  column: number,
): DistinctValue[] {
  const found = new Map<string, DistinctValue>()
  for (const row of rows) {
    const label = (row.cells[column] ?? '').trim()
    const key = fold(label)
    if (key === '') continue
    const seen = found.get(key)
    if (seen) seen.count++
    else found.set(key, { key, label, count: 1 })
  }
  return [...found.values()]
}

/**
 * The value columns holding more than `maxDistinctValues` different values: most likely the wrong
 * column, and too many choices for one page.
 */
export function crowdedValueColumns(
  rows: readonly { cells: readonly string[] }[],
  columns: ColumnMapping,
): number[] {
  return valueKinds
    .map((kind) => columns.indexOf(kind))
    .filter((index) => index >= 0 && distinctValues(rows, index).length > maxDistinctValues)
}

/** The column each value kind is mapped to, if any. */
export function valueColumns(columns: ColumnMapping): Partial<Record<ValueKind, number>> {
  const found: Partial<Record<ValueKind, number>> = {}
  for (const kind of valueKinds) {
    const index = columns.indexOf(kind)
    if (index >= 0) found[kind] = index
  }
  return found
}

/** A value, its guess and how sure the guess is. */
export interface ValueChoice extends DistinctValue {
  choice: string
  source: ValueGuessSource
}

/** What the values step shows and saves. */
export interface ValueChoices {
  category: ValueChoice[]
  condition: ValueChoice[]
  location: ValueChoice[]
}

/**
 * Guesses every value of the mapped value columns. `kept` holds choices already made for this
 * import (kept while the value is still there); `saved` the owner's template.
 */
export function guessValues(
  rows: readonly { cells: readonly string[] }[],
  columns: ColumnMapping,
  world: {
    categories: readonly CategoryChoice[]
    locations: readonly { id: string; name: string }[]
  },
  saved: ValueMapping,
  kept: ValueMapping = { category: {}, condition: {}, location: {} },
): ValueChoices {
  const at = valueColumns(columns)
  const stillOffered = (kind: ValueKind, choice: string) =>
    kind === 'category'
      ? world.categories.some((category) => category.id === choice)
      : kind === 'location'
        ? choice === '' || world.locations.some((place) => place.id === choice)
        : true
  const choicesOf = (kind: ValueKind) =>
    at[kind] === undefined
      ? []
      : distinctValues(rows, at[kind]).map((value): ValueChoice => {
          const already = Object.hasOwn(kept[kind], value.key) ? kept[kind][value.key] : undefined
          // A choice made earlier stays while it is still offered (a category may be deleted).
          if (already !== undefined && stillOffered(kind, already)) {
            return { ...value, choice: already, source: 'saved' }
          }
          return { ...value, ...guessed(kind, value.label) }
        })
  const guessed = (
    kind: ValueKind,
    label: string,
  ): { choice: string; source: ValueGuessSource } => {
    if (kind === 'category') {
      const guess = guessCategory(label, world.categories, saved.category)
      return { choice: guess?.categoryId ?? '', source: guess?.source ?? 'fallback' }
    }
    if (kind === 'condition') {
      const guess = guessCondition(label, saved.condition)
      return { choice: guess.condition ?? '', source: guess.source }
    }
    const guess = guessLocation(label, world.locations, saved.location)
    return { choice: guess.locationId ?? '', source: guess.source }
  }
  return {
    category: choicesOf('category'),
    condition: choicesOf('condition'),
    location: choicesOf('location'),
  }
}

/** The mapping to store: each value's key and choice. */
export function toValueMapping(choices: ValueChoices): ValueMapping {
  const mapping = (list: ValueChoice[]) =>
    Object.fromEntries(list.map((value) => [value.key, value.choice]))
  return {
    category: mapping(choices.category),
    condition: mapping(choices.condition),
    location: mapping(choices.location),
  }
}

/** True when nothing needs a look: every value was saved before or matched a name exactly. */
export function allValuesSure(choices: ValueChoices): boolean {
  return valueKinds.every((kind) =>
    choices[kind].every((value) => value.source === 'saved' || value.source === 'exact'),
  )
}
