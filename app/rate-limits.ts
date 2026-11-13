// Limits on what someone can make the server do repeatedly: e-mails sent on their request (ADR 0018,
// issue #70) and whole-inventory exports (US-0.10.4).
import type { Database } from 'remix/data-table'

import { hitRateLimit, type RateLimit, type RateLimitResult } from './data/rate-limits.ts'
import { listActiveModeratorEmails } from './data/users.ts'
import { type Mail, type Mailer, sendSafely } from './mail/mailer.ts'
import type { AppSettings } from './middleware/services.ts'

/** Every limit the app applies; tests may pass their own. */
export interface RateLimits {
  /** Sign-in links and sign-up answers e-mailed to one address. */
  mailsPerAddress: RateLimit
  /** Sign-in and sign-up forms posted from one client address. */
  formsPerClient: RateLimit
  /** New-collectif, responsibility and re-application requests by one user. */
  requestsPerUser: RateLimit
  /** Contact messages sent by one user (US-0.6.3). */
  contactsPerUser: RateLimit
  /** "New request" e-mails to the admins, per kind; the admin queue lists every request anyway. */
  adminNotifications: RateLimit
  /** CSV exports by one user (US-0.10.4): each reads a whole inventory. */
  exportsPerUser: RateLimit
  /** Files sent to the import by one user (US-0.10.1): each is parsed and stored for an hour. */
  uploadsPerUser: RateLimit
}

const hour = 60 * 60
const day = 24 * hour

/** Production limits (ADR 0018). */
export const defaultRateLimits: RateLimits = {
  mailsPerAddress: { limit: 5, windowSeconds: hour },
  formsPerClient: { limit: 20, windowSeconds: 15 * 60 },
  requestsPerUser: { limit: 5, windowSeconds: day },
  contactsPerUser: { limit: 10, windowSeconds: day },
  adminNotifications: { limit: 5, windowSeconds: hour },
  exportsPerUser: { limit: 30, windowSeconds: hour },
  uploadsPerUser: { limit: 20, windowSeconds: hour },
}

function limits(settings: AppSettings): RateLimits {
  return settings.rateLimits ?? defaultRateLimits
}

/** One sign-in or sign-up form posted by a visitor, counted per client address. */
export function hitFormFromClient(
  db: Database,
  settings: AppSettings,
  clientAddress: string,
): Promise<RateLimitResult> {
  return hitRateLimit(db, `form:${clientAddress}`, limits(settings).formsPerClient)
}

/** One e-mail to an address that asked for a link or an account, whether it has one or not. */
export async function mayMailAddress(
  db: Database,
  settings: AppSettings,
  email: string,
): Promise<boolean> {
  return (await hitRateLimit(db, `mail:${email}`, limits(settings).mailsPerAddress)).allowed
}

/** One CSV export by a user (US-0.10.4). */
export function hitExport(
  db: Database,
  settings: AppSettings,
  userId: string,
): Promise<RateLimitResult> {
  return hitRateLimit(db, `export:${userId}`, limits(settings).exportsPerUser)
}

/** One file sent to the import by a user (US-0.10.1). */
export function hitUpload(
  db: Database,
  settings: AppSettings,
  userId: string,
): Promise<RateLimitResult> {
  return hitRateLimit(db, `import:${userId}`, limits(settings).uploadsPerUser)
}

/** One request that notifies the admins (new collectif, responsibility, re-application). */
export function hitUserRequest(
  db: Database,
  settings: AppSettings,
  userId: string,
): Promise<RateLimitResult> {
  return hitRateLimit(db, `request:${userId}`, limits(settings).requestsPerUser)
}

/** One contact message sent by a user. */
export function hitContact(
  db: Database,
  settings: AppSettings,
  userId: string,
): Promise<RateLimitResult> {
  return hitRateLimit(db, `contact:${userId}`, limits(settings).contactsPerUser)
}

/** Kinds of request the admins and moderators are told about. */
export type AdminNotice = 'account' | 'collectif' | 'responsible'

/**
 * E-mails the admins and the active moderators about a new request (US-0.8.2), unless they were
 * told about this kind recently.
 */
export async function notifyAdmins(
  db: Database,
  mailer: Mailer,
  settings: AppSettings,
  kind: AdminNotice,
  mail: (admins: string[]) => Mail,
): Promise<void> {
  const admins = [...new Set([...settings.adminEmails, ...(await listActiveModeratorEmails(db))])]
  if (admins.length === 0) return
  const { allowed } = await hitRateLimit(db, `admins:${kind}`, limits(settings).adminNotifications)
  if (!allowed) return
  // One e-mail per person: admins and moderators never see each other's address.
  for (const to of admins) await sendSafely(mailer, mail([to]))
}
