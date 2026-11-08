// Table definitions for remix/data-table. They mirror db/migrations; the SQL is the source of truth.
import { column as c, type TableRow, table } from 'remix/data-table'

/** Account statuses (data model). */
export const userStatuses = ['pending', 'active', 'rejected', 'disabled', 'deleted'] as const
export type UserStatus = (typeof userStatuses)[number]

export const users = table({
  name: 'users',
  columns: {
    id: c.uuid(),
    email: c.text(),
    name: c.text(),
    phone: c.text().nullable(),
    status: c.enum(userStatuses),
    is_platform_admin: c.boolean(),
    rejection_reason: c.text().nullable(),
    created_at: c.timestamp({ withTimezone: true }),
    updated_at: c.timestamp({ withTimezone: true }),
    deleted_at: c.timestamp({ withTimezone: true }).nullable(),
  },
})

export type User = TableRow<typeof users>

export const sessions = table({
  name: 'sessions',
  columns: {
    id: c.text(),
    user_id: c.uuid().nullable(),
    data: c.json(),
    expires_at: c.timestamp({ withTimezone: true }),
    created_at: c.timestamp({ withTimezone: true }),
  },
})

export const signInTokens = table({
  name: 'sign_in_tokens',
  primaryKey: 'token_hash',
  columns: {
    token_hash: c.text(),
    user_id: c.uuid(),
    expires_at: c.timestamp({ withTimezone: true }),
    used_at: c.timestamp({ withTimezone: true }).nullable(),
    created_at: c.timestamp({ withTimezone: true }),
  },
})
