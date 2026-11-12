// Data access for item deletion requests (US-0.8.10): the only module that reads or writes
// `item_deletion_requests`. A member asks; a responsible of the owning collectif decides.
import { type Database, sql } from 'remix/data-table'

import { isUuid } from './ids.ts'

/** Whether someone already asked to delete this item. */
export async function hasDeletionRequest(db: Database, itemId: string): Promise<boolean> {
  if (!isUuid(itemId)) return false
  const result = await db.exec(sql`select 1 from item_deletion_requests where item_id = ${itemId}`)
  return (result.rows?.length ?? 0) > 0
}

/** Records the request; false when one is already open for this item. */
export async function requestItemDeletion(
  db: Database,
  itemId: string,
  userId: string,
): Promise<boolean> {
  const result = await db.exec(sql`
    insert into item_deletion_requests (item_id, requested_by) values (${itemId}, ${userId})
    on conflict (item_id) do nothing
    returning item_id
  `)
  return (result.rows?.length ?? 0) > 0
}

/** Closes the request without deleting the item (a responsible rejected it). */
export async function dropDeletionRequest(db: Database, itemId: string): Promise<boolean> {
  const result = await db.exec(sql`
    delete from item_deletion_requests where item_id = ${itemId} returning item_id
  `)
  return (result.rows?.length ?? 0) > 0
}

/** A request as the Membres tab lists it. */
export interface DeletionRequest {
  itemId: string
  itemName: string
  requesterName: string
  requestedAt: Date
}

/** Open requests on the items a collectif owns, oldest first. */
export async function listDeletionRequests(
  db: Database,
  collectifId: string,
): Promise<DeletionRequest[]> {
  const result = await db.exec(sql`
    select i.id, i.name, u.name as requester_name, r.requested_at
    from item_deletion_requests r
    join items i on i.id = r.item_id
    join users u on u.id = r.requested_by
    where i.owner_collectif_id = ${collectifId}
    order by r.requested_at, i.id
  `)
  return (result.rows ?? []).map((row) => ({
    itemId: String(row.id),
    itemName: String(row.name),
    requesterName: String(row.requester_name),
    requestedAt: new Date(String(row.requested_at)),
  }))
}
