// Data access for collectif memberships: the only module that reads or writes `collectif_members`
// (ADR 0020). A row links a person to a collectif with a role (member or responsible) and a status.
import { type Database, sql } from 'remix/data-table'

import { isUuid } from './ids.ts'
import {
  collectifMembers,
  type Membership,
  type MembershipRole,
  type MembershipStatus,
} from './tables.ts'

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

/** A collectif the person belongs to, with their role in it. */
export interface MyCollectif extends CollectifLink {
  role: MembershipRole
}

/** Active collectifs a person is an active member or responsible of, by name (ADR 0020). */
export async function listMyCollectifs(db: Database, userId: string): Promise<MyCollectif[]> {
  const result = await db.exec(sql`
    select c.id, c.name, c.slug, c.city, r.role from collectif_members r
    join collectifs c on c.id = r.collectif_id
    where r.user_id = ${userId} and r.status = 'active' and c.status = 'active'
    order by lower(c.name), c.id
  `)
  return (result.rows ?? []).map((row) => ({
    id: String(row.id),
    name: String(row.name),
    slug: String(row.slug),
    city: String(row.city),
    role: row.role === 'responsible' ? 'responsible' : 'member',
  }))
}

/** Records a request to join a collectif as a member (US-0.8.3). */
export async function requestMembership(
  db: Database,
  userId: string,
  collectifId: string,
): Promise<void> {
  const row = {
    role: 'member' as const,
    status: 'pending' as const,
    requested_at: new Date(),
    validated_by: null,
    validated_at: null,
  }
  await db
    .query(collectifMembers)
    .upsert(
      { user_id: userId, collectif_id: collectifId, ...row },
      { conflictTarget: ['user_id', 'collectif_id'], update: row },
    )
}

/**
 * Decides on a membership: accepted, rejected or removed by a responsible (US-0.8.4), or left by
 * the person (US-0.8.8). The expected state is part of the update, so two decisions at once cannot
 * both apply; false when the row was no longer in that state.
 */
export async function decideMembership(
  db: Database,
  input: {
    userId: string
    collectifId: string
    /** The row must hold this role (when given) and this status. */
    from: { role?: MembershipRole; status: MembershipStatus }
    status: MembershipStatus
    decidedBy: string
  },
): Promise<boolean> {
  const role = input.from.role ?? null
  const result = await db.exec(sql`
    update collectif_members
    set status = ${input.status}, validated_by = ${input.decidedBy}, validated_at = now()
    where user_id = ${input.userId} and collectif_id = ${input.collectifId}
      and status = ${input.from.status} and (${role}::text is null or role = ${role})
    returning user_id
  `)
  return (result.rows?.length ?? 0) > 0
}

/** The person's active role in a collectif, with the row locked until the transaction ends. */
export async function lockActiveRole(
  db: Database,
  userId: string,
  collectifId: string,
): Promise<MembershipRole | null> {
  const result = await db.exec(sql`
    select role from collectif_members
    where user_id = ${userId} and collectif_id = ${collectifId} and status = 'active'
    for update
  `)
  const role = result.rows?.[0]?.role
  return role === 'responsible' || role === 'member' ? role : null
}

/** A person of a collectif, as its Membres tab lists them. */
export interface CollectifPerson {
  id: string
  name: string
  role: MembershipRole
}

/** Active members and responsibles of a collectif: responsibles first, then by name. */
export async function listCollectifPeople(
  db: Database,
  collectifId: string,
): Promise<CollectifPerson[]> {
  const result = await db.exec(sql`
    select u.id, u.name, r.role from collectif_members r join users u on u.id = r.user_id
    where r.collectif_id = ${collectifId} and r.status = 'active' and u.status = 'active'
    order by r.role = 'responsible' desc, lower(u.name), u.id
  `)
  return (result.rows ?? []).map((row) => ({
    id: String(row.id),
    name: String(row.name),
    role: row.role === 'responsible' ? 'responsible' : 'member',
  }))
}

/** A pending request to join, as the responsibles see it. */
export interface MembershipRequest {
  userId: string
  name: string
  requestedAt: Date
}

/** Pending requests to join a collectif from active accounts, oldest first (US-0.8.7). */
export async function listMembershipRequests(
  db: Database,
  collectifId: string,
): Promise<MembershipRequest[]> {
  const result = await db.exec(sql`
    select u.id, u.name, r.requested_at from collectif_members r
    join users u on u.id = r.user_id and u.status = 'active'
    where r.collectif_id = ${collectifId} and r.role = 'member' and r.status = 'pending'
    order by r.requested_at, u.id
  `)
  return (result.rows ?? []).map((row) => ({
    userId: String(row.id),
    name: String(row.name),
    requestedAt: new Date(String(row.requested_at)),
  }))
}

/** E-mails of a collectif's active responsibles, each to be written to apart. */
export async function listResponsibleEmails(db: Database, collectifId: string): Promise<string[]> {
  const result = await db.exec(sql`
    select u.email from collectif_members r join users u on u.id = r.user_id
    where r.collectif_id = ${collectifId} and r.role = 'responsible' and r.status = 'active'
      and u.status = 'active'
    order by u.email
  `)
  return (result.rows ?? []).map((row) => String(row.email))
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
 * Counts the responsibles a collectif would keep without this person, locking every responsible
 * row until the transaction ends, so two removals at once cannot both succeed. Only active accounts
 * count: a disabled responsible cannot run the collectif (security review of V0.8).
 */
export async function countOtherResponsiblesForUpdate(
  db: Database,
  collectifId: string,
  exceptUserId: string,
): Promise<number> {
  const result = await db.exec(sql`
    select m.user_id, u.status from collectif_members m join users u on u.id = m.user_id
    where m.collectif_id = ${collectifId} and m.role = 'responsible' and m.status = 'active'
    for update of m
  `)
  return (result.rows ?? []).filter(
    (row) => row.status === 'active' && String(row.user_id) !== exceptUserId,
  ).length
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
    select m.collectif_id, count(*)::int as n from collectif_members m
    join users u on u.id = m.user_id and u.status = 'active'
    where m.role = 'responsible' and m.status = 'active' group by m.collectif_id
  `)
  return new Map((result.rows ?? []).map((row) => [String(row.collectif_id), Number(row.n)]))
}

/**
 * Changes an active person's role in a collectif (US-0.8.6): member ↔ responsible. False when the
 * person no longer held the other role, so a concurrent change is never applied twice.
 */
export async function setMembershipRole(
  db: Database,
  input: { userId: string; collectifId: string; role: MembershipRole; decidedBy: string },
): Promise<boolean> {
  const from: MembershipRole = input.role === 'responsible' ? 'member' : 'responsible'
  const result = await db.exec(sql`
    update collectif_members
    set role = ${input.role}, validated_by = ${input.decidedBy}, validated_at = now()
    where user_id = ${input.userId} and collectif_id = ${input.collectifId} and status = 'active'
      and role = ${from}
    returning user_id
  `)
  return (result.rows?.length ?? 0) > 0
}

/** Active collectifs whose only active responsible (with an active account) is this person. */
export async function listCollectifsRelyingOn(db: Database, userId: string): Promise<string[]> {
  const result = await db.exec(sql`
    select c.name from collectif_members m join collectifs c on c.id = m.collectif_id
    where m.user_id = ${userId} and m.role = 'responsible' and m.status = 'active'
      and c.status = 'active'
      and not exists (
        select 1 from collectif_members o join users u on u.id = o.user_id
        where o.collectif_id = m.collectif_id and o.user_id <> m.user_id
          and o.role = 'responsible' and o.status = 'active' and u.status = 'active'
      )
    order by lower(c.name)
  `)
  return (result.rows ?? []).map((row) => String(row.name))
}
