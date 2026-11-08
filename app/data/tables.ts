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

export const auditLog = table({
  name: 'audit_log',
  columns: {
    id: c.integer(),
    actor_id: c.uuid().nullable(),
    action: c.text(),
    entity: c.text(),
    entity_id: c.text(),
    payload: c.json(),
    at: c.timestamp({ withTimezone: true }),
  },
})

export const collectifStatuses = ['pending', 'active', 'rejected'] as const
export type CollectifStatus = (typeof collectifStatuses)[number]

export const collectifs = table({
  name: 'collectifs',
  columns: {
    id: c.uuid(),
    name: c.text(),
    slug: c.text(),
    description: c.text(),
    contact_phone: c.text().nullable(),
    status: c.enum(collectifStatuses),
    requested_by: c.uuid().nullable(),
    validated_by: c.uuid().nullable(),
    validated_at: c.timestamp({ withTimezone: true }).nullable(),
    rejection_reason: c.text().nullable(),
    created_at: c.timestamp({ withTimezone: true }),
    updated_at: c.timestamp({ withTimezone: true }),
  },
})

export type Collectif = TableRow<typeof collectifs>

export const responsibleStatuses = ['pending', 'active', 'rejected', 'removed'] as const
export type ResponsibleStatus = (typeof responsibleStatuses)[number]

export const responsibles = table({
  name: 'responsibles',
  primaryKey: ['user_id', 'collectif_id'],
  columns: {
    user_id: c.uuid(),
    collectif_id: c.uuid(),
    status: c.enum(responsibleStatuses),
    requested_at: c.timestamp({ withTimezone: true }),
    validated_by: c.uuid().nullable(),
    validated_at: c.timestamp({ withTimezone: true }).nullable(),
  },
})

export type Responsible = TableRow<typeof responsibles>
