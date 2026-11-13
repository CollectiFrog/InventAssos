// Loads what the database says about an import (ADR 0026): one place, so the preview and the
// confirmation see the same world.
import type { Database } from 'remix/data-table'

import { listCategories } from '../../data/categories.ts'
import {
  findOwnerItems,
  type ImportCandidate,
  type ItemOwner,
  listActiveItemNames,
  matchRefs,
} from '../../data/items.ts'
import { listCollectifLocations, listLocationsOwnedBy } from '../../data/locations.ts'
import type { Location } from '../../data/tables.ts'
import {
  type Actor,
  canChangeItem,
  canImportInto,
  canSetItemRef,
  canStoreItemsIn,
} from '../../permissions.ts'
import { fold } from './fold.ts'
import type { ColumnMapping, ExistingItem, ImportRows, ImportWorld } from './plan.ts'
import { normaliseRef } from './plan.ts'

/** The owner of a location, who owns everything imported into it. */
export function ownerOfLocation(location: Pick<Location, 'collectif_id' | 'user_id'>): ItemOwner {
  return location.collectif_id
    ? { collectifId: location.collectif_id }
    : { userId: location.user_id ?? '' }
}

function toExisting(actor: Actor, candidate: ImportCandidate): ExistingItem {
  const { item } = candidate
  return {
    id: item.id,
    ref: item.ref,
    name: item.name,
    categoryId: item.category_id,
    quantity: item.quantity,
    brand: item.brand,
    model: item.model,
    serialNumber: item.serial_number,
    condition: item.condition,
    estimatedValue: item.estimated_value,
    description: item.description,
    locationId: item.location_id,
    locationName: candidate.locationName,
    archived: item.archived_at != null,
    changeable: canChangeItem(actor, {
      ...item,
      locationCollectifId: candidate.locationCollectifId,
      locationUserId: candidate.locationUserId,
    }),
  }
}

/**
 * What the values step chooses from: the categories, and the owner's locations the actor may
 * store items in.
 */
export async function loadValueWorld(db: Database, actor: Actor, location: Location) {
  const owner = ownerOfLocation(location)
  const ownerLocations =
    'collectifId' in owner
      ? await listCollectifLocations(db, owner.collectifId)
      : await listLocationsOwnedBy(db, owner.userId, [])
  return {
    owner,
    locations: ownerLocations
      .filter((place) => canStoreItemsIn(actor, place))
      .map((place) => ({ id: place.id, name: place.name })),
    categories: (await listCategories(db)).map(({ id, name, position }) => ({
      id,
      name,
      position,
    })),
  }
}

/**
 * Builds the world of an import into `location`: the owner's locations the actor may store in, the
 * categories, the items the file's references and identifiers name, and the names already there.
 */
export async function loadImportWorld(
  db: Database,
  actor: Actor,
  location: Location,
  file: ImportRows,
  columns: ColumnMapping,
): Promise<ImportWorld> {
  // Deny by default: the pages check it first, the world refuses to exist without it.
  if (!canImportInto(actor, location)) {
    throw new Error('This person may not import into this location')
  }
  const { owner, locations, categories } = await loadValueWorld(db, actor, location)

  const cellsOf = (field: string) => {
    const index = columns.indexOf(field as ColumnMapping[number])
    if (index < 0) return []
    return file.rows.map((row) => (row.cells[index] ?? '').trim()).filter((cell) => cell !== '')
  }
  // A NUL cannot reach PostgreSQL text; such a reference is refused by the plan's field check.
  const refs = await matchRefs(
    db,
    owner,
    cellsOf('ref')
      .map(normaliseRef)
      .filter((ref) => !ref.includes('\u0000')),
  )
  const byId = await findOwnerItems(db, owner, cellsOf('id'))
  const names = await listActiveItemNames(
    db,
    locations.map((place) => place.id),
  )
  const namesByLocation = new Map<string, Set<string>>()
  for (const { locationId, name } of names) {
    const set = namesByLocation.get(locationId) ?? new Set<string>()
    set.add(fold(name))
    namesByLocation.set(locationId, set)
  }

  return {
    defaultLocation: { id: location.id, name: location.name },
    locations,
    categories,
    refs: new Map(
      [...refs].map(([ref, { key, candidate }]) => [
        ref,
        { key, item: candidate ? toExisting(actor, candidate) : null },
      ]),
    ),
    itemsById: new Map(byId.map((candidate) => [candidate.item.id, toExisting(actor, candidate)])),
    namesByLocation,
    maySetRef: canSetItemRef(actor, owner),
  }
}
