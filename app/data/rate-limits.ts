// Rate-limit counters (ADR 0018): the only module that touches `rate_limits`.
import { createHash } from 'node:crypto'

import { type Database, lt, sql } from 'remix/data-table'

import { rateLimits } from './tables.ts'

/** At most `limit` hits per window of `windowSeconds`. */
export interface RateLimit {
  limit: number
  windowSeconds: number
}

/** The outcome of one hit: allowed or not, and when the window ends. */
export interface RateLimitResult {
  allowed: boolean
  retryAfterSeconds: number
}

/**
 * Counts one hit on `key` and says whether it stays within the limit. One upsert does the read and
 * the write, so concurrent requests cannot both slip under the limit. Only a hash of the key is kept.
 */
export async function hitRateLimit(
  db: Database,
  key: string,
  rule: RateLimit,
): Promise<RateLimitResult> {
  const keyHash = createHash('sha256').update(key).digest('hex')
  const window = `${rule.windowSeconds} seconds`
  const result = await db.exec(sql`
    insert into rate_limits (key_hash, hits, reset_at)
    values (${keyHash}, 1, now() + ${window}::interval)
    on conflict (key_hash) do update set
      hits = case when rate_limits.reset_at <= now() then 1 else rate_limits.hits + 1 end,
      reset_at = case when rate_limits.reset_at <= now() then excluded.reset_at
                      else rate_limits.reset_at end
    returning hits, extract(epoch from (reset_at - now()))::int as retry_after
  `)
  const row = result.rows?.[0] ?? {}
  return {
    allowed: Number(row.hits) <= rule.limit,
    retryAfterSeconds: Math.max(1, Number(row.retry_after)),
  }
}

/** Deletes the counters whose window has ended; run with the other purges. */
export async function deleteExpiredRateLimits(db: Database): Promise<void> {
  await db.deleteMany(rateLimits, { where: lt(rateLimits.reset_at, new Date()) })
}
