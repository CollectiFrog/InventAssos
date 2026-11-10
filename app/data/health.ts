import { type Database, sql } from 'remix/data-table'

/** Returns true when the database answers a trivial query. */
export async function pingDatabase(db: Database): Promise<boolean> {
  try {
    await db.exec(sql`select 1`)
    return true
  } catch {
    return false
  }
}
