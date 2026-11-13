// Data access for imports in progress (ADR 0026): the only module that reads or writes `imports`.
// Every read is for its author and only while it lives; nothing here is ever logged.
import { type Database, sql } from 'remix/data-table'

import { isUuid } from './ids.ts'

/** An import in progress, as the pages use it. */
export interface PendingImport {
  id: string
  createdBy: string
  locationId: string
  fileName: string
  header: string[]
  rows: { n: number; cells: string[] }[]
  /** One field key (or null) per column of the header. */
  columnMapping: (string | null)[]
  /** Rows set aside (an archived item's reference) that the person chose to add anyway. */
  forcedRows: number[]
  /** The values the person chose on the values step; the others are guessed when shown. */
  valueMapping: {
    category: Record<string, string>
    condition: Record<string, string>
    location: Record<string, string>
  }
  expiresAt: Date
}

/** JSON columns may come back as text or as values, depending on the driver. */
function json<value>(raw: unknown, fallback: value): value {
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as value
    } catch {
      return fallback
    }
  }
  return (raw ?? fallback) as value
}

const emptyValues = { category: {}, condition: {}, location: {} }

function toPending(row: Record<string, unknown>): PendingImport {
  const values = json<Partial<PendingImport['valueMapping']>>(row.value_mapping, emptyValues)
  return {
    id: String(row.id),
    createdBy: String(row.created_by),
    locationId: String(row.location_id),
    fileName: String(row.file_name),
    header: json<string[]>(row.header, []),
    rows: json<{ n: number; c: string[] }[]>(row.rows, []).map(({ n, c }) => ({ n, cells: c })),
    columnMapping: json<(string | null)[]>(row.column_mapping, []),
    forcedRows: Array.isArray(row.forced_rows) ? row.forced_rows.map(Number) : [],
    valueMapping: {
      category: values.category ?? {},
      condition: values.condition ?? {},
      location: values.location ?? {},
    },
    expiresAt: new Date(String(row.expires_at)),
  }
}

/**
 * Starts an import for its author, replacing the one they had in progress (one per person): a
 * corrected file is simply sent again.
 */
export async function createImport(
  db: Database,
  input: {
    createdBy: string
    locationId: string
    fileName: string
    header: string[]
    rows: { n: number; cells: string[] }[]
    columnMapping: (string | null)[]
    valueMapping?: PendingImport['valueMapping']
  },
): Promise<string> {
  await db.exec(sql`delete from imports where created_by = ${input.createdBy}`)
  const result = await db.exec(sql`
    insert into imports
      (created_by, location_id, file_name, header, rows, row_count, column_mapping, value_mapping)
    values (
      ${input.createdBy}, ${input.locationId}, ${input.fileName},
      ${JSON.stringify(input.header)}::jsonb,
      ${JSON.stringify(input.rows.map(({ n, cells }) => ({ n, c: cells })))}::jsonb,
      ${input.rows.length},
      ${JSON.stringify(input.columnMapping)}::jsonb,
      ${JSON.stringify(input.valueMapping ?? emptyValues)}::jsonb
    )
    returning id
  `)
  return String(result.rows?.[0]?.id)
}

/**
 * The author's import, while it lives; null for anyone else's, an expired one, or an unknown ID,
 * so that the page answers the same 404 for all (its existence never leaks). `lock` holds the
 * row until the transaction ends, so a double confirmation runs once.
 */
export async function findImport(
  db: Database,
  id: string,
  userId: string,
  options: { lock?: boolean } = {},
): Promise<PendingImport | null> {
  if (!isUuid(id)) return null
  const result = await db.exec(sql`
    select * from imports
    where id = ${id} and created_by = ${userId} and expires_at > now()
    ${options.lock ? sql`for update` : sql``}
  `)
  const row = result.rows?.[0]
  return row ? toPending(row) : null
}

/** Saves the mapping a step validated. */
export async function saveImportMapping(
  db: Database,
  id: string,
  mapping: { columnMapping?: (string | null)[]; valueMapping?: PendingImport['valueMapping'] },
): Promise<void> {
  if (mapping.columnMapping) {
    await db.exec(sql`
      update imports set column_mapping = ${JSON.stringify(mapping.columnMapping)}::jsonb
      where id = ${id}
    `)
  }
  if (mapping.valueMapping) {
    await db.exec(sql`
      update imports set value_mapping = ${JSON.stringify(mapping.valueMapping)}::jsonb
      where id = ${id}
    `)
  }
}

/** Adds or removes a row from those the person forces in (ADR 0027). */
export async function setForcedRow(
  db: Database,
  id: string,
  rowNumber: number,
  forced: boolean,
): Promise<void> {
  await db.exec(sql`
    update imports set forced_rows = ${
      forced
        ? sql`array(select distinct unnest(forced_rows || ${rowNumber}::int))`
        : sql`array_remove(forced_rows, ${rowNumber}::int)`
    }
    where id = ${id}
  `)
}

/** Ends an import: confirmed or abandoned. */
export async function deleteImport(db: Database, id: string): Promise<void> {
  await db.exec(sql`delete from imports where id = ${id}`)
}

/** The hourly purge: imports past their hour. */
export async function deleteExpiredImports(db: Database): Promise<void> {
  await db.exec(sql`delete from imports where expires_at <= now()`)
}
