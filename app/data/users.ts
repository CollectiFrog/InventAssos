// Data access for accounts: the only module that reads or writes the `users` table.
import type { Database } from 'remix/data-table'

import { type User, type UserStatus, users } from './tables.ts'

/** E-mails are compared case-insensitively: store and look them up in this form. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

/** Finds an account by e-mail, whatever its status. */
export async function findUserByEmail(db: Database, email: string): Promise<User | null> {
  return db.findOne(users, { where: { email: normalizeEmail(email) } })
}

/** Finds an account by ID. */
export async function findUserById(db: Database, id: string): Promise<User | null> {
  return db.find(users, id)
}

/** Creates an account; `pending` unless a status is given (platform admins start `active`). */
export async function createUser(
  db: Database,
  input: { email: string; name: string; status?: UserStatus },
): Promise<User> {
  return db.create(
    users,
    {
      email: normalizeEmail(input.email),
      name: input.name.trim(),
      status: input.status ?? 'pending',
    },
    { returnRow: true },
  )
}

/** Changes an account's status; clears the rejection reason unless one is given. */
export async function setUserStatus(
  db: Database,
  id: string,
  status: UserStatus,
  rejectionReason: string | null = null,
): Promise<User> {
  return db.update(users, id, {
    status,
    rejection_reason: rejectionReason,
    updated_at: new Date(),
  })
}

/**
 * Aligns an account with PLATFORM_ADMIN_EMAILS (US-0.2.5): a listed e-mail becomes an active admin
 * without approval; an e-mail removed from the list loses the flag. Disabled accounts stay disabled.
 */
export async function syncPlatformAdmin(
  db: Database,
  user: User,
  adminEmails: ReadonlySet<string>,
): Promise<User> {
  const listed = adminEmails.has(user.email)
  const activate = listed && (user.status === 'pending' || user.status === 'rejected')
  if (!activate && user.is_platform_admin === listed) return user

  return db.update(users, user.id, {
    is_platform_admin: listed,
    ...(activate ? { status: 'active' as const, rejection_reason: null } : {}),
    updated_at: new Date(),
  })
}

/** Accounts waiting for approval, oldest first. */
export async function listPendingUsers(db: Database): Promise<User[]> {
  return db.findMany(users, { where: { status: 'pending' }, orderBy: ['created_at', 'asc'] })
}
