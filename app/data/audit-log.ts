// Append-only audit log (ADR 0010): the only module that writes `audit_log`.
import { type Database, rawSql } from 'remix/data-table'

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

/** One history line, with the IDs it mentions already turned into names where they still exist. */
export interface HistoryEntry {
  action: string
  at: Date
  actorName: string | null
  payload: Record<string, unknown>
  /** Location names for `fromLocationId` / `toLocationId` / `locationId`; null when deleted. */
  locationNames: Record<string, string | null>
}

/**
 * History of one object for display. The log keeps IDs only (ADR 0010): names are looked up now,
 * so a purged account or a deleted location simply shows as unknown.
 */
export async function readHistory(
  db: Database,
  entity: string,
  entityId: string,
): Promise<HistoryEntry[]> {
  const entries = await listEntityHistory(db, entity, entityId)
  const payloads = entries.map((entry) =>
    typeof entry.payload === 'string' ? JSON.parse(entry.payload) : (entry.payload ?? {}),
  ) as Record<string, unknown>[]
  const actorIds = [...new Set(entries.map((e) => e.actor_id).filter((id) => id !== null))]
  const locationIds = [
    ...new Set(
      payloads.flatMap((p) =>
        ['fromLocationId', 'toLocationId', 'locationId']
          .map((key) => p[key])
          .filter((id): id is string => typeof id === 'string'),
      ),
    ),
  ]
  const actors = await namesById(db, 'users', actorIds)
  const places = await namesById(db, 'locations', locationIds)

  return entries.map((entry, index) => {
    const payload = payloads[index] ?? {}
    const locationNames: Record<string, string | null> = {}
    for (const key of ['fromLocationId', 'toLocationId', 'locationId']) {
      const id = payload[key]
      if (typeof id === 'string') locationNames[key] = places.get(id) ?? null
    }
    return {
      action: entry.action,
      at: new Date(String(entry.at)),
      actorName: entry.actor_id ? (actors.get(entry.actor_id) ?? null) : null,
      payload,
      locationNames,
    }
  })
}

async function namesById(
  db: Database,
  tableName: 'users' | 'locations',
  ids: string[],
): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map()
  // Table name from a fixed union, never from input.
  const result = await db.exec(
    rawSql(`select id::text as id, name from ${tableName} where id = any(?::uuid[])`, [ids]),
  )
  return new Map((result.rows ?? []).map((row) => [String(row.id), String(row.name)]))
}
