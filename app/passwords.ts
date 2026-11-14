// Password hashing and rules (ADR 0029). scrypt from node:crypto, so no new dependency; the
// parameters travel with each hash, so they can be raised later without breaking stored ones.
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'

/** Shortest password accepted: 12 characters, no composition rule (ADR 0029). */
export const passwordMinLength = 12
/** Longest password accepted; bounds the work a single request can ask for. */
export const passwordMaxLength = 128

// OWASP's scrypt profile N=2^15, r=8, p=3: 32 MiB per hash, which fits the pod's memory limit.
const cost = { N: 2 ** 15, r: 8, p: 3 }
const keyLength = 64
const maxmem = 128 * 1024 * 1024

function derive(
  password: string,
  salt: Buffer,
  params: { N: number; r: number; p: number },
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password.normalize('NFC'), salt, keyLength, { ...params, maxmem }, (error, key) =>
      error ? reject(error) : resolve(key),
    )
  })
}

/** The French message for a password that breaks the rules, or null when it is fine. */
export function passwordProblem(password: string): string | null {
  const length = [...password].length
  if (length < passwordMinLength) {
    return `Choisissez au moins ${passwordMinLength} caractères.`
  }
  if (length > passwordMaxLength) return `Pas plus de ${passwordMaxLength} caractères.`
  return null
}

/** Hashes a password as `scrypt$N$r$p$salt$key` (base64url). */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16)
  const key = await derive(password, salt, cost)
  return ['scrypt', cost.N, cost.r, cost.p, salt.toString('base64url'), key.toString('base64url')]
    .map(String)
    .join('$')
}

/** A valid hash of a password nobody knows, checked when the account has none (same timing). */
let decoy: Promise<string> | null = null

/**
 * Whether `password` matches `stored`. With no stored hash it still does the work and answers
 * false, so the time taken does not tell whether an account has a password.
 */
export async function verifyPassword(password: string, stored: string | null): Promise<boolean> {
  decoy ??= hashPassword(randomBytes(32).toString('base64url'))
  const hash = stored ?? (await decoy)
  const [scheme, n, r, p, salt, key] = hash.split('$')
  if (scheme !== 'scrypt' || !salt || !key || [...password].length > passwordMaxLength) {
    return false
  }
  const expected = Buffer.from(key, 'base64url')
  const params = { N: Number(n), r: Number(r), p: Number(p) }
  const actual = await derive(password, Buffer.from(salt, 'base64url'), params)
  return stored !== null && actual.length === expected.length && timingSafeEqual(actual, expected)
}
