// Data access for items and categories: the only module that reads or writes them.
import { type Database, sql } from 'remix/data-table'

import { type Category, categories, type Item, items } from './tables.ts'

/** Owner of an item: a collectif or a person, never both (ADR 0009). */
export type ItemOwner = { collectifId: string } | { userId: string }

/** The fields a person fills in for an item; owner and location are handled apart. */
export interface ItemFields {
  name: string
  categoryId: string
  quantity: number
  brand: string | null
  model: string | null
  serialNumber: string | null
  condition: Item['condition']
  estimatedValue: number | null
  description: string | null
}

/** The fixed list of categories, in display order. */
export async function listCategories(db: Database): Promise<Category[]> {
  return db.findMany(categories, { orderBy: ['position', 'asc'] })
}

function toColumns(fields: ItemFields) {
  return {
    name: fields.name,
    category_id: fields.categoryId,
    quantity: fields.quantity,
    brand: fields.brand,
    model: fields.model,
    serial_number: fields.serialNumber,
    condition: fields.condition,
    estimated_value: fields.estimatedValue,
    description: fields.description,
  }
}

/** Creates an item in a location for its owner. */
export async function createItem(
  db: Database,
  input: { fields: ItemFields; locationId: string; owner: ItemOwner; createdBy: string },
): Promise<Item> {
  return db.create(
    items,
    {
      ...toColumns(input.fields),
      location_id: input.locationId,
      owner_collectif_id: 'collectifId' in input.owner ? input.owner.collectifId : null,
      owner_user_id: 'userId' in input.owner ? input.owner.userId : null,
      created_by: input.createdBy,
    },
    { returnRow: true },
  )
}

/** Finds an item by ID, archived or not. */
export async function findItemById(db: Database, id: string): Promise<Item | null> {
  return db.find(items, id)
}

/** An item with the names needed to display it. */
export interface ItemSummary {
  id: string
  name: string
  quantity: number
  categoryName: string
  locationId: string
  locationName: string
  city: string
  ownerName: string
  archivedAt: Date | null
}

function toSummary(row: Record<string, unknown>): ItemSummary {
  return {
    id: String(row.id),
    name: String(row.name),
    quantity: Number(row.quantity),
    categoryName: String(row.category_name),
    locationId: String(row.location_id),
    locationName: String(row.location_name),
    city: String(row.city),
    ownerName: String(row.owner_name ?? ''),
    archivedAt: row.archived_at == null ? null : new Date(String(row.archived_at)),
  }
}

const summaryColumns = sql`
  i.id, i.name, i.quantity, i.location_id, i.archived_at,
  cat.name as category_name, l.name as location_name, l.city,
  coalesce(oc.name, ou.name) as owner_name
`
const summaryJoins = sql`
  join categories cat on cat.id = i.category_id
  join locations l on l.id = i.location_id
  left join collectifs oc on oc.id = i.owner_collectif_id
  left join users ou on ou.id = i.owner_user_id
`

/**
 * Active items a person deals with: owned by them or by a collectif they manage, or stored in a
 * location they or those collectifs own.
 */
export async function listItemsManagedBy(
  db: Database,
  userId: string,
  collectifIds: readonly string[],
): Promise<ItemSummary[]> {
  const ids = [...collectifIds]
  const result = await db.exec(sql`
    select ${summaryColumns} from items i ${summaryJoins}
    where i.archived_at is null and (
      i.owner_user_id = ${userId}
      or i.owner_collectif_id = any(${ids}::uuid[])
      or l.user_id = ${userId}
      or l.collectif_id = any(${ids}::uuid[])
    )
    order by i.name
  `)
  return (result.rows ?? []).map(toSummary)
}

/** Everything the item page shows, with the location's owner for permission checks. */
export interface ItemDetails extends Item {
  categoryName: string
  locationName: string
  city: string
  locationCollectifId: string | null
  locationUserId: string | null
  ownerName: string
  ownerSlug: string | null
}

/** Loads an item with its category, location and owner names. */
export async function findItemDetails(db: Database, id: string): Promise<ItemDetails | null> {
  const item = await findItemById(db, id)
  if (item === null) return null
  const result = await db.exec(sql`
    select cat.name as category_name, l.name as location_name, l.city,
           l.collectif_id as location_collectif_id, l.user_id as location_user_id,
           coalesce(oc.name, ou.name) as owner_name, oc.slug as owner_slug
    from items i ${summaryJoins}
    where i.id = ${id}
  `)
  const row = result.rows?.[0] ?? {}
  return {
    ...item,
    categoryName: String(row.category_name ?? ''),
    locationName: String(row.location_name ?? ''),
    city: String(row.city ?? ''),
    locationCollectifId:
      row.location_collectif_id == null ? null : String(row.location_collectif_id),
    locationUserId: row.location_user_id == null ? null : String(row.location_user_id),
    ownerName: String(row.owner_name ?? ''),
    ownerSlug: row.owner_slug == null ? null : String(row.owner_slug),
  }
}

/** True when items, archived ones included, are stored in the location: it cannot be deleted. */
export async function locationHoldsItems(db: Database, locationId: string): Promise<boolean> {
  const item = await db.findOne(items, { where: { location_id: locationId } })
  return item !== null
}
