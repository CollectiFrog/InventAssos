// Data access for storage locations: the only module that reads or writes `locations`.
import { type Database, inList, or, sql } from 'remix/data-table'

import { type Location, locations } from './tables.ts'

/** Who owns a location: a collectif or a person, never both (ADR 0009). */
export type LocationOwner = { collectifId: string } | { userId: string }

/** The editable fields of a location. */
export interface LocationFields {
  name: string
  city: string
  address: string | null
  notes: string | null
}

/** Finds a location by ID. */
export async function findLocationById(db: Database, id: string): Promise<Location | null> {
  return db.find(locations, id)
}

/** Creates a location for its owner. */
export async function createLocation(
  db: Database,
  owner: LocationOwner,
  fields: LocationFields,
): Promise<Location> {
  return db.create(
    locations,
    {
      ...fields,
      collectif_id: 'collectifId' in owner ? owner.collectifId : null,
      user_id: 'userId' in owner ? owner.userId : null,
    },
    { returnRow: true },
  )
}

/** Updates a location's fields; the owner never changes. */
export async function updateLocation(
  db: Database,
  id: string,
  fields: LocationFields,
): Promise<Location> {
  return db.update(locations, id, { ...fields, updated_at: new Date() })
}

/** Deletes a location. From V0.5, PostgreSQL refuses it while items are stored there. */
export async function deleteLocation(db: Database, id: string): Promise<void> {
  await db.delete(locations, id)
}

/** Locations of one collectif, by name. */
export async function listCollectifLocations(
  db: Database,
  collectifId: string,
): Promise<Location[]> {
  return db.findMany(locations, { where: { collectif_id: collectifId }, orderBy: ['name', 'asc'] })
}

/** A location with the display name of its owner. */
export type LocationWithOwner = Location & { ownerName: string }

/** Locations owned by a person or by any of the given collectifs, with the owner's name. */
export async function listLocationsOwnedBy(
  db: Database,
  userId: string,
  collectifIds: readonly string[],
): Promise<LocationWithOwner[]> {
  const rows = await db.findMany(locations, {
    where:
      collectifIds.length > 0
        ? or({ user_id: userId }, inList(locations.collectif_id, [...collectifIds]))
        : { user_id: userId },
    orderBy: ['name', 'asc'],
  })
  if (rows.length === 0) return []

  const names = await db.exec(sql`
    select id::text, name from collectifs where id = any(${[...collectifIds]}::uuid[])
  `)
  const collectifNames = new Map((names.rows ?? []).map((r) => [String(r.id), String(r.name)]))
  return rows.map((row) => ({
    ...row,
    ownerName: row.collectif_id ? (collectifNames.get(row.collectif_id) ?? '') : 'Moi',
  }))
}

/**
 * Removes the private fields before a location reaches someone who may not see them
 * (`canSeeFullAddress`): only the city of a storage place is public (ADR 0010).
 */
export function redactLocation<T extends { address: string | null; notes: string | null }>(
  location: T,
  canSeeFullAddress: boolean,
): T {
  return canSeeFullAddress ? location : { ...location, address: null, notes: null }
}

/** Loads a location with its owner's display name (collectif or person). */
export async function findLocationWithOwner(
  db: Database,
  id: string,
): Promise<(Location & { ownerName: string; ownerSlug: string | null }) | null> {
  const result = await db.exec(sql`
    select l.*, coalesce(c.name, u.name) as owner_name, c.slug as owner_slug
    from locations l
    left join collectifs c on c.id = l.collectif_id
    left join users u on u.id = l.user_id
    where l.id = ${id}
  `)
  const row = result.rows?.[0]
  if (row === undefined) return null
  const location = await findLocationById(db, id)
  if (location === null) return null
  return {
    ...location,
    ownerName: String(row.owner_name ?? ''),
    ownerSlug: row.owner_slug == null ? null : String(row.owner_slug),
  }
}
