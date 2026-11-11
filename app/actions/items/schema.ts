import * as s from 'remix/data-schema'
import * as f from 'remix/data-schema/form-data'

import { itemConditions } from '../../data/tables.ts'
import { optionalText, requiredText } from '../../validation.ts'

const quantity = s
  .defaulted(s.string(), '')
  .transform((value) => value.trim() || '1')
  .refine((value) => /^\d{1,6}$/.test(value), 'Indiquez un nombre entier.')
  .transform(Number)
  .refine((value) => value >= 1, 'Au moins 1.')

const euros = s
  .defaulted(s.string(), '')
  .transform((value) => value.trim().replace(/\s/g, '').replace(',', '.'))
  .refine((value) => value === '' || /^\d{1,7}(\.\d{1,2})?$/.test(value), 'Montant invalide.')
  .transform((value) => (value === '' ? null : Number(value)))

const condition = s
  .defaulted(s.string(), '')
  .refine(
    (value) => value === '' || (itemConditions as readonly string[]).includes(value),
    'État inconnu.',
  )
  .transform((value) => (value === '' ? null : (value as (typeof itemConditions)[number])))

/** The descriptive fields of an item, shared by creation and edition. */
export const itemFieldsSchema = f.object({
  name: f.field(requiredText(120)),
  categoryId: f.field(requiredText(40)),
  quantity: f.field(quantity),
  brand: f.field(optionalText(120)),
  model: f.field(optionalText(120)),
  serialNumber: f.field(optionalText(120)),
  condition: f.field(condition),
  estimatedValue: f.field(euros),
  description: f.field(optionalText(2000)),
})

/** Names of the descriptive fields, to re-display a submitted form. */
export const itemFieldNames = [
  'name',
  'categoryId',
  'quantity',
  'brand',
  'model',
  'serialNumber',
  'condition',
  'estimatedValue',
  'description',
] as const

/** Raw submitted values, keyed by field name. */
export type ItemFormValues = Record<(typeof itemFieldNames)[number], string>

/** Value of « Rangé dans » that asks for a new location, described in the same form (US-0.7.4). */
export const newLocationChoice = 'nouveau'

/** The new location's fields in the add form; address and notes are added later on its page. */
export const newLocationSchema = f.object({
  newLocationName: f.field(requiredText(120)),
  newLocationCity: f.field(requiredText(120)),
})
