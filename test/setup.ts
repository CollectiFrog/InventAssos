// Runs once before the whole test run (remix.json → test.setup).
import { migrateDatabase, openDatabase } from '../app/db.ts'
import { testDatabaseUrl } from './database.ts'

/** Applies migrations to the test database once, so test files start from the current schema. */
export async function globalSetup() {
  const db = openDatabase(testDatabaseUrl)
  try {
    await migrateDatabase(db)
  } finally {
    await db.close()
  }
}
