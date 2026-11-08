// Single-use sign-in links: the only module that touches `sign_in_tokens`.
import { createHash, randomBytes } from 'node:crypto'

import { type Database, lt, notNull, or, sql } from 'remix/data-table'

import { signInTokens } from './tables.ts'

/** A link is valid 15 minutes (open point US-0.2.2). */
export const signInTokenTtlMs = 15 * 60 * 1000

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

/** Creates a token for a user and returns it in clear; only its hash is stored. */
export async function createSignInToken(db: Database, userId: string): Promise<string> {
  const token = randomBytes(32).toString('base64url')
  await db.create(signInTokens, {
    token_hash: hashToken(token),
    user_id: userId,
    expires_at: new Date(Date.now() + signInTokenTtlMs),
  })
  return token
}

/**
 * Marks a token used and returns its user ID, or null when unknown, expired or already used.
 * One UPDATE does the check and the write, so two clicks cannot both succeed.
 */
export async function consumeSignInToken(db: Database, token: string): Promise<string | null> {
  const result = await db.exec(sql`
    update sign_in_tokens set used_at = now()
    where token_hash = ${hashToken(token)} and used_at is null and expires_at > now()
    returning user_id
  `)
  const userId = result.rows?.[0]?.user_id
  return typeof userId === 'string' ? userId : null
}

/** Deletes used and expired tokens; run at startup. */
export async function deleteStaleSignInTokens(db: Database): Promise<void> {
  await db.deleteMany(signInTokens, {
    where: or(lt(signInTokens.expires_at, new Date()), notNull(signInTokens.used_at)),
  })
}
