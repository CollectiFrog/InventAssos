// Housekeeping of rows that expire: run at startup, then on a timer while the server runs.
import type { Database } from 'remix/data-table'

import { deleteExpiredRateLimits } from './data/rate-limits.ts'
import { deleteExpiredSessions } from './data/sessions.ts'
import { deleteStaleSignInTokens } from './data/sign-in-tokens.ts'

/** How often the server purges expired rows. */
export const purgeIntervalMs = 60 * 60 * 1000

/** Deletes expired sessions, used or expired sign-in tokens and ended rate-limit windows. */
export async function purgeExpiredData(db: Database): Promise<void> {
  await deleteExpiredSessions(db)
  await deleteStaleSignInTokens(db)
  await deleteExpiredRateLimits(db)
}

/** Calls `run` every `intervalMs` until the returned function is called. Tests pass their own. */
export type Repeat = (run: () => Promise<void>, intervalMs: number) => () => void

/** The real scheduler: `setInterval`, which never keeps the process alive on its own. */
export const repeatWithTimer: Repeat = (run, intervalMs) => {
  const timer = setInterval(run, intervalMs)
  // Optional: the test runner's fake timers return a handle without unref.
  timer.unref?.()
  return () => clearInterval(timer)
}

/**
 * Purges every `intervalMs` until the returned function is called; it resolves once a purge still
 * running has finished. A failure is only logged.
 */
export function startPeriodicPurge(
  db: Database,
  intervalMs = purgeIntervalMs,
  repeat: Repeat = repeatWithTimer,
): () => Promise<void> {
  let running: Promise<void> | null = null
  const cancel = repeat(() => {
    // A slow purge makes the next tick wait for it instead of running a second one alongside.
    running ??= purgeExpiredData(db)
      .catch((error: unknown) => console.error('Periodic purge failed', error))
      .finally(() => {
        running = null
      })
    return running
  }, intervalMs)
  return async () => {
    cancel()
    await running
  }
}
