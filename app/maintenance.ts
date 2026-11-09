// Housekeeping of rows that expire: run at startup, then on a timer while the server runs.
import type { Database } from 'remix/data-table'

import { deleteExpiredSessions } from './data/sessions.ts'
import { deleteStaleSignInTokens } from './data/sign-in-tokens.ts'

/** How often the server purges expired rows. */
export const purgeIntervalMs = 60 * 60 * 1000

/** Deletes expired sessions and used or expired sign-in tokens. */
export async function purgeExpiredData(db: Database): Promise<void> {
  await deleteExpiredSessions(db)
  await deleteStaleSignInTokens(db)
}

/** Purges every `intervalMs` until the returned function is called; a failure is only logged. */
export function startPeriodicPurge(db: Database, intervalMs = purgeIntervalMs): () => void {
  const timer = setInterval(() => {
    purgeExpiredData(db).catch((error: unknown) => console.error('Periodic purge failed', error))
  }, intervalMs)
  // Never keeps the process alive on its own.
  timer.unref()
  return () => clearInterval(timer)
}
