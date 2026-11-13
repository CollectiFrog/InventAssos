// Data access for import templates (US-0.10.1, ADR 0027): the only module that reads or writes
// `import_templates`. What an owner chose last, so that their next file is mapped the same way.
import { type Database, sql } from 'remix/data-table'

import type { ItemOwner } from './items.ts'

/** Saved choices: column title keys to fields, value keys to categories, conditions, locations. */
export interface ImportTemplate {
  columnMap: Record<string, string>
  valueMap: {
    category: Record<string, string>
    condition: Record<string, string>
    location: Record<string, string>
  }
}

/** Most saved column titles, and most saved values per kind: beyond, the latest import's win. */
const maxColumns = 100
const maxValues = 300

const empty = (): ImportTemplate => ({
  columnMap: {},
  valueMap: { category: {}, condition: {}, location: {} },
})

/** JSON columns may come back as text or as values, depending on the driver. */
function json(raw: unknown): Record<string, unknown> {
  const value = typeof raw === 'string' ? (JSON.parse(raw) as unknown) : raw
  return value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : {}
}

/** Keeps only text values: what the database holds is the app's, but never trusted blindly. */
function strings(raw: unknown): Record<string, string> {
  const out: Record<string, string> = Object.create(null)
  for (const [key, value] of Object.entries(json(raw))) {
    if (typeof value === 'string') out[key] = value
  }
  return out
}

function ownerCondition(owner: ItemOwner) {
  return 'collectifId' in owner
    ? sql`collectif_id = ${owner.collectifId}`
    : sql`user_id = ${owner.userId}`
}

/** The owner's template, or an empty one. */
export async function findTemplate(db: Database, owner: ItemOwner): Promise<ImportTemplate> {
  const result = await db.exec(sql`select * from import_templates where ${ownerCondition(owner)}`)
  const row = result.rows?.[0]
  if (!row) return empty()
  const values = json(row.value_map)
  return {
    columnMap: strings(row.column_map),
    valueMap: {
      category: strings(values.category),
      condition: strings(values.condition),
      location: strings(values.location),
    },
  }
}

/** Merges new choices over old ones; past the cap, the new choices alone are kept. */
function merge(old: Record<string, string>, next: Record<string, string>, cap: number) {
  const merged = { ...old, ...next }
  return Object.keys(merged).length > cap ? { ...next } : merged
}

/** Saves what the person validated, merged over what the owner chose before. */
export async function saveTemplate(
  db: Database,
  owner: ItemOwner,
  choices: Partial<ImportTemplate>,
  updatedBy: string,
): Promise<void> {
  const old = await findTemplate(db, owner)
  const columnMap = merge(old.columnMap, choices.columnMap ?? {}, maxColumns)
  const valueMap = {
    category: merge(old.valueMap.category, choices.valueMap?.category ?? {}, maxValues),
    condition: merge(old.valueMap.condition, choices.valueMap?.condition ?? {}, maxValues),
    location: merge(old.valueMap.location, choices.valueMap?.location ?? {}, maxValues),
  }
  const collectifId = 'collectifId' in owner ? owner.collectifId : null
  const userId = 'userId' in owner ? owner.userId : null
  // One row per owner: two saves at once update it in turn instead of colliding.
  const conflict = collectifId
    ? sql`(collectif_id) where collectif_id is not null`
    : sql`(user_id) where user_id is not null`
  await db.exec(sql`
    insert into import_templates (collectif_id, user_id, column_map, value_map, updated_by)
    values (${collectifId}, ${userId}, ${JSON.stringify(columnMap)}::jsonb,
      ${JSON.stringify(valueMap)}::jsonb, ${updatedBy})
    on conflict ${conflict} do update
    set column_map = excluded.column_map, value_map = excluded.value_map,
        updated_by = excluded.updated_by, updated_at = now()
  `)
}
