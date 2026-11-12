// Data access for collectif memberships: the only module that reads or writes `collectif_members`
// (ADR 0020). A row links a person to a collectif with a role (member or responsible) and a status.
import { type Database, sql } from 'remix/data-table'

import { isUuid } from './ids.ts'
import { collectifMembers, type Membership, type MembershipStatus } from './tables.ts'

/** The row linking a person to a collectif, whatever its role and status. */
export async function findMembership(
  db: Database,
  userId: string,
  collectifId: string,
): Promise<Membership | null> {
  if (!isUuid(userId) || !isUuid(collectifId)) return null
  return db.findOne(collectifMembers, { where: { user_id: userId, collectif_id: collectifId } })
}

/** The person's row as a responsible of the collectif (requested, active…), or null. */
export async function findResponsible(
  db: Database,
  userId: string,
  collectifId: string,
): Promise<Membership | null> {
  const row = await findMembership(db, userId, collectifId)
  return row?.role === 'responsible' ? row : null
}

/** Creates or overwrites the link between a person and a collectif, as a responsible. */
export async function setResponsible(
  db: Database,
  input: {
    userId: string
    collectifId: string
    status: MembershipStatus
    validatedBy?: string | null
  },
): Promise<void> {
  const validated = input.status === 'pending' ? null : new Date()
  const row = {
    role: 'responsible' as const,
    status: input.status,
    validated_by: input.validatedBy ?? null,
    validated_at: validated,
    ...(input.status === 'pending' ? { requested_at: new Date() } : {}),
  }
  await db
    .query(collectifMembers)
    .upsert(
      { user_id: input.userId, collectif_id: input.collectifId, ...row },
      { conflictTarget: ['user_id', 'collectif_id'], update: row },
    )
}

/** A collectif as the navigation shows it. */
export interface CollectifLink {
  id: string
  name: string
  slug: string
  city: string
}

/** Active collectifs a person is an active responsible of, by name. */
export async function listManagedCollectifs(
  db: Database,
  userId: string,
): Promise<CollectifLink[]> {
  const result = await db.exec(sql`
    select c.id, c.name, c.slug, c.city from collectif_members r
    join collectifs c on c.id = r.collectif_id
    where r.user_id = ${userId} and r.role = 'responsible' and r.status = 'active'
      and c.status = 'active'
    order by lower(c.name), c.id
  `)
  return (result.rows ?? []).map((row) => ({
    id: String(row.id),
    name: String(row.name),
    slug: String(row.slug),
    city: String(row.city),
  }))
}

/** Active responsibles of a collectif (ID and name), for display. */
export async function listActiveResponsibles(
  db: Database,
  collectifId: string,
): Promise<{ id: string; name: string }[]> {
  const result = await db.exec(sql`
    select u.id, u.name from collectif_members r join users u on u.id = r.user_id
    where r.collectif_id = ${collectifId} and r.role = 'responsible' and r.status = 'active'
    order by u.name
  `)
  return (result.rows ?? []).map((row) => ({ id: String(row.id), name: String(row.name) }))
}

/**
 * Counts active responsibles, locking their rows until the transaction ends, so two admins
 * removing the last two responsibles at once cannot both succeed.
 */
export async function countActiveResponsiblesForUpdate(
  db: Database,
  collectifId: string,
): Promise<number> {
  const result = await db.exec(sql`
    select user_id from collectif_members
    where collectif_id = ${collectifId} and role = 'responsible' and status = 'active'
    for update
  `)
  return result.rows?.length ?? 0
}

/** A pending responsible request, with what the admin needs to decide. */
export interface PendingResponsible {
  userId: string
  userName: string
  userEmail: string
  collectifId: string
  collectifName: string
  requestedAt: Date
}

/** Pending requests on active collectifs from active accounts, oldest first. */
export async function listPendingResponsibles(db: Database): Promise<PendingResponsible[]> {
  const result = await db.exec(sql`
    select r.user_id, u.name as user_name, u.email as user_email,
           r.collectif_id, c.name as collectif_name, r.requested_at
    from collectif_members r
    join users u on u.id = r.user_id and u.status = 'active'
    join collectifs c on c.id = r.collectif_id and c.status = 'active'
    where r.role = 'responsible' and r.status = 'pending'
    order by r.requested_at
  `)
  return (result.rows ?? []).map((row) => ({
    userId: String(row.user_id),
    userName: String(row.user_name),
    userEmail: String(row.user_email),
    collectifId: String(row.collectif_id),
    collectifName: String(row.collectif_name),
    requestedAt: new Date(String(row.requested_at)),
  }))
}

/** How many active responsibles each collectif has; a collectif with none is absent. */
export async function countActiveResponsibles(db: Database): Promise<Map<string, number>> {
  const result = await db.exec(sql`
    select collectif_id, count(*)::int as n from collectif_members
    where role = 'responsible' and status = 'active' group by collectif_id
  `)
  return new Map((result.rows ?? []).map((row) => [String(row.collectif_id), Number(row.n)]))
}
