import { fileURLToPath } from 'node:url'

import type { Database } from 'remix/data-table'
import { loadMigrations } from 'remix/data-table/migrations/node'
import { createPostgresDatabase } from 'remix/data-table/postgres'

const migrationsDir = fileURLToPath(new URL('../db/migrations/', import.meta.url))

/** Opens the PostgreSQL connection pool. */
export function openDatabase(connectionString: string): Database {
  return createPostgresDatabase({ connectionString })
}

/** Applies pending migrations; the PostgreSQL adapter holds an advisory lock while it runs. */
export async function migrateDatabase(db: Database): Promise<void> {
  const migrations = await loadMigrations(migrationsDir)
  await db.migrate(migrations)
}
