// Test database helpers. Tests run one file at a time (remix.json) against TEST_DATABASE_URL.
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

/** Truncates every table except the migration journal and seeded reference data. */
export async function resetDatabase(db: Database): Promise<void> {
  const result = await db.exec(sql`
    select tablename from pg_tables
    where schemaname = 'public'
      and tablename not in ('data_table_migrations', 'categories')
  `)
  const tables = (result.rows ?? []).map((row) => `"${String(row.tablename)}"`)
  if (tables.length === 0) return
  // Table names come from pg_tables, not from user input.
  await db.executeScript(`truncate ${tables.join(', ')} restart identity cascade`)
}
