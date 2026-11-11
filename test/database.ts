// Test database helpers. Tests run one file at a time (remix.json) against TEST_DATABASE_URL.
import { readFile } from 'node:fs/promises'

import { type Database, sql } from 'remix/data-table'

import { migrateDatabase, openDatabase } from '../app/db.ts'

const defaultUrl = 'postgres://inventassos:inventassos@localhost:5432/inventassos_test'

/** Connection string of the dedicated test database; never the development one. */
export const testDatabaseUrl = process.env.TEST_DATABASE_URL ?? defaultUrl

/** Opens the test database, applies migrations and empties every application table. */
export async function openTestDatabase(): Promise<Database> {
  const db = openDatabase(testDatabaseUrl)
  await migrateDatabase(db)
  await resetDatabase(db)
  return db
}

/** The seeded categories, read from the migration that inserts them (one source of truth). */
const categorySeed = readFile(
  new URL('../db/migrations/0007_items/up.sql', import.meta.url),
  'utf8',
).then((file) => {
  const start = file.indexOf('insert into categories')
  return file.slice(start, file.indexOf(';', start) + 1)
})

/**
 * Truncates every table except the migration journal, and puts the seeded categories back:
 * admins may change them since V0.7 (US-0.7.10).
 */
export async function resetDatabase(db: Database): Promise<void> {
  const result = await db.exec(sql`
    select tablename from pg_tables
    where schemaname = 'public' and tablename <> 'data_table_migrations'
  `)
  const tables = (result.rows ?? []).map((row) => `"${String(row.tablename)}"`)
  if (tables.length === 0) return
  // Table names come from pg_tables, not from user input.
  await db.executeScript(`truncate ${tables.join(', ')} restart identity cascade`)
  await db.executeScript(await categorySeed)
}
