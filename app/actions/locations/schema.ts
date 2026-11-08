import * as f from 'remix/data-schema/form-data'

import { optionalText, requiredText } from '../../validation.ts'

/** Fields of the location form; the owner is read separately on creation. */
export const locationSchema = f.object({
  name: f.field(requiredText(120)),
  city: f.field(requiredText(120)),
  address: f.field(optionalText(300)),
  notes: f.field(optionalText(2000)),
})
