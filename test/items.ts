// Test fixtures for items.
import type { Database } from 'remix/data-table'

import { createItem, type ItemFields, type ItemOwner } from '../app/data/items.ts'
import type { Item } from '../app/data/tables.ts'

/** Valid form fields for an item, overridable. */
export function itemFormFields(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    name: 'Console Yamaha',
    categoryId: 'sound',
    quantity: '2',
    brand: 'Yamaha',
    model: 'MG10',
    serialNumber: '',
    condition: 'good',
    estimatedValue: '150,50',
    description: '',
    ...overrides,
  }
}

/** Creates an item directly in the database. */
export async function createTestItem(
  db: Database,
  input: { locationId: string; owner: ItemOwner; createdBy: string; name?: string; ref?: string },
): Promise<Item> {
  const fields: ItemFields = {
    name: input.name ?? 'Projecteur',
    categoryId: 'lighting',
    quantity: 1,
    brand: null,
    model: null,
    serialNumber: null,
    ref: input.ref ?? null,
    condition: null,
    estimatedValue: null,
    description: null,
  }
  return createItem(db, {
    fields,
    locationId: input.locationId,
    owner: input.owner,
    createdBy: input.createdBy,
  })
}
