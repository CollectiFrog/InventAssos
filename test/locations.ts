// Test fixtures for storage locations.
import type { Database } from 'remix/data-table'

import { createLocation, type LocationOwner } from '../app/data/locations.ts'
import type { Location } from '../app/data/tables.ts'

/** Creates a location with a street address, so tests can check who sees it. */
export async function createTestLocation(
  db: Database,
  owner: LocationOwner,
  name = 'Local',
): Promise<Location> {
  return createLocation(db, owner, {
    name,
    city: 'Rennes',
    address: '12 rue Secrète',
    notes: 'Code 1234',
  })
}
