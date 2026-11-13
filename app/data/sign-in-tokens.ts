// Single-use e-mailed links, to sign in or to choose a password: the only module that touches
// `sign_in_tokens`.
import { createHash, randomBytes } from 'node:crypto'

import { type Database, lt, notNull, or, sql } from 'remix/data-table'

import { signInTokens, type TokenPurpose } from './tables.ts'

/** A sign-in link is valid 15 minutes (open point US-0.2.2). */
export const signInTokenTtlMs = 15 * 60 * 1000
/** A password link is valid 30 minutes: choosing a password takes longer than a click (ADR 0029). */
export const passwordTokenTtlMs = 30 * 60 * 1000

const ttlOf: Record<TokenPurpose, number> = {
  sign_in: signInTokenTtlMs,
  password_reset: passwordTokenTtlMs,
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

/** Creates a token for a user and returns it in clear; only its hash is stored. */
export async function createSignInToken(
  db: Database,
  userId: string,
  purpose: TokenPurpose = 'sign_in',
): Promise<string> {
  const token = randomBytes(32).toString('base64url')
  await db.create(signInTokens, {
    token_hash: hashToken(token),
    user_id: userId,
    purpose,
    expires_at: new Date(Date.now() + ttlOf[purpose]),
  })
  return token
}

/** Whether a token could still be used, without using it: the password form shows it first. */
export async function isTokenUsable(
  db: Database,
  token: string,
  purpose: TokenPurpose,
): Promise<boolean> {
  const result = await db.exec(sql`
    select 1 from sign_in_tokens
    where token_hash = ${hashToken(token)} and purpose = ${purpose}
      and used_at is null and expires_at > now()
  `)
  return (result.rows?.length ?? 0) > 0
}

/** Uses up every open token of a user for one purpose, e.g. older password links once one served. */
export async function closeUserTokens(
  db: Database,
  userId: string,
  purpose: TokenPurpose,
): Promise<void> {
  await db.exec(sql`
    update sign_in_tokens set used_at = now()
    where user_id = ${userId} and purpose = ${purpose} and used_at is null
  `)
}

/**
 * Marks a token used and returns its user ID, or null when unknown, expired or already used.
 * One UPDATE does the check and the write, so two clicks cannot both succeed.
 */
export async function consumeSignInToken(
  db: Database,
  token: string,
  purpose: TokenPurpose = 'sign_in',
): Promise<string | null> {
  const result = await db.exec(sql`
    update sign_in_tokens set used_at = now()
    where token_hash = ${hashToken(token)} and purpose = ${purpose}
      and used_at is null and expires_at > now()
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
