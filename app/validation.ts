// Form parsing helpers on top of remix/data-schema, with French messages for the UI.
import * as s from 'remix/data-schema'

import type { FieldErrors } from './ui/form.tsx'

/**
 * True when the text holds a line break or another control character: C0, DEL and C1 (what a
 * Windows-1252 file read as Latin-1 produces). Same set as the database checks, written out so
 * that no server locale changes it.
 */
export function hasControlCharacter(value: string): boolean {
  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index)
    if (code <= 0x1f || (code >= 0x7f && code <= 0x9f)) return true
  }
  return false
}

/**
 * A required, trimmed, single-line text of at most `max` characters. Names end up in e-mail
 * subjects and bodies: a line break in one would let its author shape the message.
 */
export function requiredText(max: number) {
  return s
    .defaulted(s.string(), '')
    .transform((value) => value.trim())
    .refine((value) => value.length > 0, 'Ce champ est obligatoire.')
    .refine((value) => !hasControlCharacter(value), 'Une seule ligne, sans retour à la ligne.')
    .refine((value) => value.length <= max, `${max} caractères au maximum.`)
}

/**
 * An optional, trimmed, single-line text: blank becomes null (a reference, a code). Normalised to
 * NFC, so that « é » typed on a Mac (e + accent) and on Windows (one character) are one value:
 * references are compared with `inv_fold`, which only knows precomposed letters.
 */
export function optionalLine(max: number) {
  // Normalised before it is measured: NFC can lengthen a few characters, and the database checks
  // the stored length.
  return s
    .defaulted(s.string(), '')
    .transform((value) => value.trim().normalize('NFC'))
    .refine((value) => value.length <= max, `${max} caractères au maximum.`)
    .refine((value) => !hasControlCharacter(value), 'Une seule ligne, sans retour à la ligne.')
    .transform((value) => (value === '' ? null : value))
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

const phonePattern = /^\+?[0-9 .()-]{6,25}$/

/** An optional phone number: digits, spaces, dots, dashes, parentheses, an optional leading +. */
export function optionalPhone() {
  return optionalText(25).refine(
    (value) => value === null || phonePattern.test(value),
    'Numéro de téléphone invalide.',
  )
}
