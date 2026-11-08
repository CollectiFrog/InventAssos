// Append-only audit log (ADR 0010): the only module that writes `audit_log`.
import type { Database } from 'remix/data-table'

import { auditLog } from './tables.ts'

/**
 * Payload values allowed in the log: IDs, enums, counts, booleans.
 * Never put free text typed by a person here (a name, a reason, an address): it may be personal.
 */
export type AuditPayload = Record<string, string | number | boolean | null>

/** One entry to append. */
export interface AuditEntry {
  actorId: string | null
  action: string
  entity: string
  entityId: string
  payload?: AuditPayload
}

/** Appends one entry; call it inside the same transaction as the change it records. */
export async function logAction(db: Database, entry: AuditEntry): Promise<void> {
  await db.create(auditLog, {
    actor_id: entry.actorId,
    action: entry.action,
    entity: entry.entity,
    entity_id: entry.entityId,
    payload: JSON.stringify(entry.payload ?? {}),
  })
}

/** Entries about one object, oldest first. */
export async function listEntityHistory(db: Database, entity: string, entityId: string) {
  return db.findMany(auditLog, {
    where: { entity, entity_id: entityId },
    orderBy: [
      ['at', 'asc'],
      ['id', 'asc'],
    ],
  })
}
