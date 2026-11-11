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

export const rateLimits = table({
  name: 'rate_limits',
  primaryKey: 'key_hash',
  columns: {
    key_hash: c.text(),
    hits: c.integer(),
    reset_at: c.timestamp({ withTimezone: true }),
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
    /** Empty only for a collectif created before V0.7 with no location (migration 0010). */
    city: c.text(),
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

export const locations = table({
  name: 'locations',
  columns: {
    id: c.uuid(),
    name: c.text(),
    city: c.text(),
    address: c.text().nullable(),
    notes: c.text().nullable(),
    collectif_id: c.uuid().nullable(),
    user_id: c.uuid().nullable(),
    created_at: c.timestamp({ withTimezone: true }),
    updated_at: c.timestamp({ withTimezone: true }),
  },
})

export type Location = TableRow<typeof locations>

export const categories = table({
  name: 'categories',
  columns: {
    id: c.text(),
    name: c.text(),
    parent_id: c.text().nullable(),
    position: c.integer(),
  },
})

export type Category = TableRow<typeof categories>

/** Item conditions, stored in English, shown in French (`conditionLabels`). */
export const itemConditions = ['new', 'good', 'worn', 'repair', 'broken'] as const
export type ItemCondition = (typeof itemConditions)[number]

/** Why an item left the inventory (US-0.5.5). */
export const archiveReasons = ['sold', 'lost', 'broken', 'other'] as const
export type ArchiveReason = (typeof archiveReasons)[number]

export const items = table({
  name: 'items',
  columns: {
    id: c.uuid(),
    name: c.text(),
    description: c.text().nullable(),
    category_id: c.text(),
    brand: c.text().nullable(),
    model: c.text().nullable(),
    serial_number: c.text().nullable(),
    quantity: c.integer(),
    condition: c.enum(itemConditions).nullable(),
    estimated_value: c.decimal(10, 2).nullable(),
    location_id: c.uuid(),
    owner_collectif_id: c.uuid().nullable(),
    owner_user_id: c.uuid().nullable(),
    archived_at: c.timestamp({ withTimezone: true }).nullable(),
    archive_reason: c.enum(archiveReasons).nullable(),
    created_by: c.uuid().nullable(),
    created_at: c.timestamp({ withTimezone: true }),
    updated_at: c.timestamp({ withTimezone: true }),
  },
})

export type Item = TableRow<typeof items>
