// Data access for items and categories: the only module that reads or writes them.
import { type Database, sql } from 'remix/data-table'

import { isUuid } from './ids.ts'
import { likeLiteral } from './search.ts'
import { type Item, items } from './tables.ts'

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
  /** The owner's own reference, unique per owner (US-0.10.3). */
  ref: string | null
  condition: Item['condition']
  estimatedValue: number | null
  description: string | null
}

function toColumns(fields: ItemFields) {
  return {
    name: fields.name,
    category_id: fields.categoryId,
    quantity: fields.quantity,
    brand: fields.brand,
    model: fields.model,
    serial_number: fields.serialNumber,
    ref: fields.ref,
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

/**
 * Whether another item of this owner, archived ones included, already has this reference. Compared
 * as the unique index does (`inv_fold`), so « AMP-01 » and « amp-01 » collide.
 */
export async function refTaken(
  db: Database,
  owner: ItemOwner,
  ref: string,
  exceptItemId: string | null = null,
): Promise<boolean> {
  const ownerCondition =
    'collectifId' in owner
      ? sql`owner_collectif_id = ${owner.collectifId}`
      : sql`owner_user_id = ${owner.userId}`
  const result = await db.exec(sql`
    select 1 from items
    where ${ownerCondition} and ref is not null and inv_fold(ref) = inv_fold(${ref})
      and (${exceptItemId}::uuid is null or id <> ${exceptItemId}::uuid)
    limit 1
  `)
  return (result.rows?.length ?? 0) > 0
}

/** True when a write failed on the per-owner reference index (a race after `refTaken`). */
export function isRefConflict(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code
  const constraint = String((error as { constraint?: unknown } | null)?.constraint ?? '')
  const cause = (error as { cause?: unknown } | null)?.cause
  if (code === '23505' && constraint.startsWith('items_ref_')) return true
  return cause !== undefined && cause !== error && isRefConflict(cause)
}

/** Finds an item by ID, archived or not. */
export async function findItemById(db: Database, id: string): Promise<Item | null> {
  return isUuid(id) ? db.find(items, id) : null
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
  /** Set when a person owns the item. */
  ownerUserId: string | null
  /** Set when a collectif owns the item. */
  ownerCollectifId: string | null
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
    ownerUserId: row.owner_user_id == null ? null : String(row.owner_user_id),
    ownerCollectifId: row.owner_collectif_id == null ? null : String(row.owner_collectif_id),
    archivedAt: row.archived_at == null ? null : new Date(String(row.archived_at)),
  }
}

const summaryColumns = sql`
  i.id, i.name, i.quantity, i.location_id, i.archived_at, i.owner_user_id, i.owner_collectif_id,
  cat.name as category_name, l.name as location_name, l.city,
  coalesce(oc.name, ou.name) as owner_name
`
const summaryJoins = sql`
  join categories cat on cat.id = i.category_id
  join locations l on l.id = i.location_id
  left join collectifs oc on oc.id = i.owner_collectif_id
  left join users ou on ou.id = i.owner_user_id
`

/** Columns a list of items can be sorted by (`?tri=`, US-0.7.13). */
export const itemSortColumns = ['nom', 'categorie', 'quantite', 'ville', 'proprietaire'] as const

/** One column, ascending or descending; ties are broken by name. */
export interface ItemSort {
  column: (typeof itemSortColumns)[number]
  descending: boolean
}

/** The ORDER BY of a sort, from a fixed list of expressions: never text from the URL. */
function orderBy(sort: ItemSort = { column: 'nom', descending: false }) {
  const expression = {
    nom: sql`lower(i.name)`,
    categorie: sql`cat.position`,
    quantite: sql`i.quantity`,
    ville: sql`lower(l.city)`,
    proprietaire: sql`lower(coalesce(oc.name, ou.name))`,
  }[sort.column]
  return sort.descending
    ? sql`order by ${expression} desc, lower(i.name), i.id`
    : sql`order by ${expression}, lower(i.name), i.id`
}

/** Whose point of view a listing takes; built by `itemScopeOf` in app/permissions.ts. */
export type ItemScope =
  | { everything: true }
  | { everything: false; userId: string; collectifIds: readonly string[] }

/**
 * The SQL side of `canSeeItem` (ADR 0021), over `items i` joined to `locations l`. Keep both in
 * step: app/data/items.visibility.test.ts compares them.
 */
function visibleIn(scope: ItemScope) {
  if (scope.everything) return sql`true`
  const ids = [...scope.collectifIds]
  return sql`(
    i.owner_user_id = ${scope.userId}
    or i.owner_collectif_id = any(${ids}::uuid[])
    or exists (
      select 1 from collectif_members vr
      where vr.user_id = i.owner_user_id and vr.status = 'active'
        and vr.collectif_id = any(${ids}::uuid[])
    )
    or l.user_id = ${scope.userId}
    or l.collectif_id = any(${ids}::uuid[])
  )`
}

/** Splits the comma-joined IDs of a `string_agg`. */
function idList(value: unknown): string[] {
  return typeof value === 'string' && value !== '' ? value.split(',') : []
}

/** Active items stored right now in a person's own locations, by name (US-0.7.3). */
export async function listItemsStoredAtHomeOf(
  db: Database,
  userId: string,
): Promise<ItemSummary[]> {
  const result = await db.exec(sql`
    select ${summaryColumns} from items i ${summaryJoins}
    where i.archived_at is null and l.user_id = ${userId}
    order by lower(i.name), i.id
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
  /** Set when a person owns the item, to link to their page. */
  ownerUserId: string | null
  /** The collectif's contact phone, or the owner's phone while their account is active. */
  contactPhone: string | null
  /** Collectifs the owning person belongs to, for `canSeeItem` and `canSeePerson`. */
  ownerCollectifIds: string[]
}

/** Loads an item with its category, location and owner names. */
export async function findItemDetails(db: Database, id: string): Promise<ItemDetails | null> {
  const item = await findItemById(db, id)
  if (item === null) return null
  const result = await db.exec(sql`
    select cat.name as category_name, l.name as location_name, l.city,
           l.collectif_id as location_collectif_id, l.user_id as location_user_id,
           coalesce(oc.name, ou.name) as owner_name, oc.slug as owner_slug,
           case when i.owner_collectif_id is not null then oc.contact_phone
                when ou.status = 'active' then ou.phone end as contact_phone,
           (select string_agg(r.collectif_id::text, ',') from collectif_members r
            join collectifs rc on rc.id = r.collectif_id
            where r.user_id = i.owner_user_id and r.status = 'active' and rc.status = 'active'
           ) as owner_collectif_ids
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
    contactPhone: row.contact_phone == null ? null : String(row.contact_phone),
    ownerUserId: item.owner_user_id,
    ownerCollectifIds: idList(row.owner_collectif_ids),
  }
}

/** True when items, archived ones included, are stored in the location: it cannot be deleted. */
export async function locationHoldsItems(db: Database, locationId: string): Promise<boolean> {
  const item = await db.findOne(items, { where: { location_id: locationId } })
  return item !== null
}

/** Updates the descriptive fields; returns the names of the fields that changed (for the log). */
export async function updateItemFields(
  db: Database,
  item: Item,
  fields: ItemFields,
): Promise<string[]> {
  const next = toColumns(fields)
  const changed = (Object.keys(next) as (keyof typeof next)[]).filter((key) => {
    const before = item[key]
    const after = next[key]
    if (key === 'estimated_value') {
      return (before === null ? null : Number(before)) !== after
    }
    return before !== after
  })
  if (changed.length > 0) await db.update(items, item.id, { ...next, updated_at: new Date() })
  return changed
}

/** Stores the item in another location. */
export async function moveItem(db: Database, itemId: string, locationId: string): Promise<void> {
  await db.update(items, itemId, { location_id: locationId, updated_at: new Date() })
}

/** Takes an item out of the inventory, keeping its row and history (no hard delete in V0.x). */
export async function archiveItem(
  db: Database,
  itemId: string,
  reason: NonNullable<Item['archive_reason']>,
): Promise<void> {
  await db.update(items, itemId, {
    archived_at: new Date(),
    archive_reason: reason,
    updated_at: new Date(),
  })
}

/**
 * Deletes an item for good (US-0.8.9), with its pending deletion request. The audit log keeps its
 * entries, which hold IDs only (ADR 0010).
 */
export async function deleteItem(db: Database, itemId: string): Promise<void> {
  await db.exec(sql`delete from items where id = ${itemId}`)
}

/** One page of the active inventory, and how many items match in total. */
export interface InventoryPage {
  items: ItemSummary[]
  total: number
}

/** Search and filters of the inventory (US-0.6.2); empty values mean "any". */
export interface InventoryFilters {
  query?: string
  categoryId?: string
  collectifId?: string
  city?: string
}

/** Active items the scope may see, by name, one page at a time (US-0.6.2, US-0.7.11). */
export async function listInventory(
  db: Database,
  options: {
    scope: ItemScope
    page: number
    pageSize: number
    filters?: InventoryFilters
    sort?: ItemSort
  },
): Promise<InventoryPage> {
  const f = options.filters ?? {}
  const conditions = [sql`i.archived_at is null`, visibleIn(options.scope)]
  if (f.query) {
    conditions.push(sql`inv_fold(concat_ws(' ', i.name, i.ref, i.brand, i.model, i.description))
      like '%' || inv_fold(${likeLiteral(f.query)}) || '%'`)
  }
  if (f.categoryId) conditions.push(sql`i.category_id = ${f.categoryId}`)
  if (f.collectifId) conditions.push(sql`i.owner_collectif_id = ${f.collectifId}::uuid`)
  if (f.city) conditions.push(sql`inv_fold(l.city) = inv_fold(${f.city})`)
  let where = sql`where ${conditions[0] ?? sql`true`}`
  for (const condition of conditions.slice(1)) where = sql`${where} and ${condition}`

  const offset = (Math.max(1, options.page) - 1) * options.pageSize
  const count = await db.exec(sql`select count(*)::int as n from items i ${summaryJoins} ${where}`)
  const result = await db.exec(sql`
    select ${summaryColumns} from items i ${summaryJoins} ${where}
    ${orderBy(options.sort)}
    limit ${options.pageSize} offset ${offset}
  `)
  return { items: (result.rows ?? []).map(toSummary), total: Number(count.rows?.[0]?.n ?? 0) }
}

/** Cities that hold at least one active item the scope may see, for the city filter. */
export async function listInventoryCities(db: Database, scope: ItemScope): Promise<string[]> {
  const result = await db.exec(sql`
    select distinct l.city from items i join locations l on l.id = i.location_id
    where i.archived_at is null and ${visibleIn(scope)} order by l.city
  `)
  return (result.rows ?? []).map((row) => String(row.city))
}

/** E-mails that receive a contact message about an item: its owner, or the collectif's responsibles. */
export async function listOwnerContactEmails(db: Database, item: Item): Promise<string[]> {
  const result = item.owner_collectif_id
    ? await db.exec(sql`
        select u.email from collectif_members r join users u on u.id = r.user_id
        where r.collectif_id = ${item.owner_collectif_id} and r.role = 'responsible'
          and r.status = 'active'
          and u.status = 'active'
      `)
    : await db.exec(sql`
        select email from users where id = ${item.owner_user_id} and status = 'active'
      `)
  return (result.rows ?? []).map((row) => String(row.email))
}

/**
 * What an export holds (US-0.10.4): the active items an owner owns, wherever they are stored, that
 * the scope may see, by name; with their category name and their location's name, nothing else of
 * the location.
 */
export async function listItemsForExport(
  db: Database,
  owner: ItemOwner,
  scope: ItemScope,
): Promise<{ item: Item; categoryName: string; locationName: string }[]> {
  const condition =
    'collectifId' in owner
      ? sql`i.owner_collectif_id = ${owner.collectifId}`
      : sql`i.owner_user_id = ${owner.userId}`
  const result = await db.exec(sql`
    select i.*, cat.name as category_name, l.name as location_name
    from items i
    join categories cat on cat.id = i.category_id
    join locations l on l.id = i.location_id
    where i.archived_at is null and ${condition} and ${visibleIn(scope)}
    order by lower(i.name), i.id
  `)
  return (result.rows ?? []).map((row) => {
    const { category_name, location_name, ...item } = row
    return {
      item: item as unknown as Item,
      categoryName: String(category_name),
      locationName: String(location_name),
    }
  })
}

/** Active items owned by a collectif or a person that the scope may see, by name (US-0.6.4). */
export async function listItemsOwnedBy(
  db: Database,
  owner: ItemOwner,
  scope: ItemScope,
  sort?: ItemSort,
): Promise<ItemSummary[]> {
  const condition =
    'collectifId' in owner
      ? sql`i.owner_collectif_id = ${owner.collectifId}`
      : sql`i.owner_user_id = ${owner.userId}`
  const result = await db.exec(sql`
    select ${summaryColumns} from items i ${summaryJoins}
    where i.archived_at is null and ${condition} and ${visibleIn(scope)}
    ${orderBy(sort)}
  `)
  return (result.rows ?? []).map(toSummary)
}

/** True when the scope may see an active item stored in the location (its page names it). */
export async function locationShowsItemTo(
  db: Database,
  locationId: string,
  scope: ItemScope,
): Promise<boolean> {
  const result = await db.exec(sql`
    select 1 from items i join locations l on l.id = i.location_id
    where i.location_id = ${locationId} and i.archived_at is null and ${visibleIn(scope)}
    limit 1
  `)
  return (result.rows?.length ?? 0) > 0
}

/** The most recently added active items the scope may see, newest first (US-0.7.2). */
export async function listRecentItems(
  db: Database,
  scope: ItemScope,
  limit: number,
): Promise<ItemSummary[]> {
  const result = await db.exec(sql`
    select ${summaryColumns} from items i ${summaryJoins}
    where i.archived_at is null and ${visibleIn(scope)}
    order by i.created_at desc, i.id
    limit ${limit}
  `)
  return (result.rows ?? []).map(toSummary)
}

/** How many active items each of these collectifs owns; a collectif with none is absent. */
export async function countItemsOwnedBy(
  db: Database,
  collectifIds: readonly string[],
): Promise<Map<string, number>> {
  const ids = [...collectifIds]
  const result = await db.exec(sql`
    select owner_collectif_id, count(*)::int as n from items
    where archived_at is null and owner_collectif_id = any(${ids}::uuid[])
    group by owner_collectif_id
  `)
  return new Map((result.rows ?? []).map((row) => [String(row.owner_collectif_id), Number(row.n)]))
}

/** Active items stored in a collectif's locations but owned by someone else: its deposits. */
export async function listItemsDepositedAt(
  db: Database,
  collectifId: string,
  scope: ItemScope,
): Promise<ItemSummary[]> {
  const result = await db.exec(sql`
    select ${summaryColumns} from items i ${summaryJoins}
    where i.archived_at is null and l.collectif_id = ${collectifId}
      and i.owner_collectif_id is distinct from ${collectifId}::uuid and ${visibleIn(scope)}
    order by lower(i.name), i.id
  `)
  return (result.rows ?? []).map(toSummary)
}

/** How many items, archived ones included, use each category; an unused one is absent. */
export async function countItemsByCategory(db: Database): Promise<Map<string, number>> {
  const result = await db.exec(sql`
    select category_id, count(*)::int as n from items group by category_id
  `)
  return new Map((result.rows ?? []).map((row) => [String(row.category_id), Number(row.n)]))
}

/** Moves every item, archived ones included, from one category to another; returns their IDs. */
export async function recategorizeItems(
  db: Database,
  fromId: string,
  toId: string,
): Promise<string[]> {
  const result = await db.exec(sql`
    update items set category_id = ${toId}, updated_at = now()
    where category_id = ${fromId}
    returning id
  `)
  return (result.rows ?? []).map((row) => String(row.id))
}

/** How many visible active items each category and each city holds, for the filters' counts. */
export async function countVisibleItems(
  db: Database,
  scope: ItemScope,
): Promise<{ byCategory: Map<string, number>; byCity: Map<string, number> }> {
  const visible = sql`from items i join locations l on l.id = i.location_id
    where i.archived_at is null and ${visibleIn(scope)}`
  const categories = await db.exec(sql`select i.category_id as k, count(*)::int as n ${visible}
    group by i.category_id`)
  const cities = await db.exec(
    sql`select l.city as k, count(*)::int as n ${visible} group by l.city`,
  )
  const toMap = (rows: Record<string, unknown>[] | undefined) =>
    new Map((rows ?? []).map((row) => [String(row.k), Number(row.n)]))
  return { byCategory: toMap(categories.rows), byCity: toMap(cities.rows) }
}
