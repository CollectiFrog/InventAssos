import type { Database } from 'remix/data-table'
import { createContextKey, type Middleware } from 'remix/router'

/** Context key for the shared database; actions read it as `context.db`. */
export const DatabaseKey = createContextKey<Database>()

/** Puts the application's database on every request context. */
export function provideDatabase(db: Database): Middleware<{
  key: typeof DatabaseKey
  value: Database
  property: 'db'
}> {
  return (context, next) => {
    context.set(DatabaseKey, db, { property: 'db' })
    return next()
  }
}
