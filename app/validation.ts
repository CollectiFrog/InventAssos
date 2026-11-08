// Form parsing helpers on top of remix/data-schema, with French messages for the UI.
import * as s from 'remix/data-schema'

import type { FieldErrors } from './ui/form.tsx'

/** A required, trimmed text of at most `max` characters. */
export function requiredText(max: number) {
  return s
    .defaulted(s.string(), '')
    .transform((value) => value.trim())
    .refine((value) => value.length > 0, 'Ce champ est obligatoire.')
    .refine((value) => value.length <= max, `${max} caractères au maximum.`)
}

/** An optional, trimmed text: blank becomes null. */
export function optionalText(max: number) {
  return s
    .defaulted(s.string(), '')
    .transform((value) => value.trim())
    .refine((value) => value.length <= max, `${max} caractères au maximum.`)
    .transform((value) => (value === '' ? null : value))
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** A required e-mail address, trimmed and lower-cased. */
export function emailAddress() {
  return requiredText(254)
    .transform((value) => value.toLowerCase())
    .refine((value) => emailPattern.test(value), 'Adresse e-mail invalide.')
}

/** Result of `parseForm`: the typed value, or one French message per invalid field. */
export type ParseResult<output> = { ok: true; value: output } | { ok: false; errors: FieldErrors }

/** Validates submitted data against a schema and maps issues to field names. */
export function parseForm<output>(
  schema: s.Schema<unknown, output>,
  data: FormData | URLSearchParams,
): ParseResult<output> {
  const result = s.parseSafe(schema, data, { abortEarly: false })
  if (result.success) return { ok: true, value: result.value }

  const errors: FieldErrors = {}
  for (const issue of result.issues) {
    const first = issue.path?.[0]
    const key = typeof first === 'object' && first !== null ? first.key : first
    const name = key === undefined ? '_form' : String(key)
    errors[name] ??= issue.message
  }
  return { ok: false, errors }
}

/** Reads a form field as a string, for re-displaying submitted values. */
export function formValue(data: FormData, name: string): string {
  const value = data.get(name)
  return typeof value === 'string' ? value : ''
}
