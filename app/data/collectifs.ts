// Data access for collectifs: the only module that reads or writes the `collectifs` table.
import { and, type Database, ne, sql } from 'remix/data-table'

import { isUuid } from './ids.ts'
import { type Collectif, type CollectifStatus, collectifs } from './tables.ts'

/** URL-safe form of a name; two names with the same slug count as the same collectif. */
export function slugify(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** The pending or active collectif using this slug, if any (rejected ones free their name). */
export async function findCollectifHoldingSlug(
  db: Database,
  slug: string,
): Promise<Collectif | null> {
  return db.findOne(collectifs, { where: and({ slug }, ne(collectifs.status, 'rejected')) })
}

/** Finds a collectif by ID, whatever its status. */
export async function findCollectifById(db: Database, id: string): Promise<Collectif | null> {
  return isUuid(id) ? db.find(collectifs, id) : null
}

/** Finds the active collectif with this slug. */
export async function findActiveCollectifBySlug(
  db: Database,
  slug: string,
): Promise<Collectif | null> {
  return db.findOne(collectifs, { where: { slug, status: 'active' } })
}

/** Records a request for a new collectif, `pending` until a platform admin decides. */
export async function createCollectifRequest(
  db: Database,
  input: { name: string; description: string; contactPhone: string | null; requestedBy: string },
): Promise<Collectif> {
  return db.create(
    collectifs,
    {
      name: input.name,
      slug: slugify(input.name),
      description: input.description,
      contact_phone: input.contactPhone,
      requested_by: input.requestedBy,
    },
    { returnRow: true },
  )
}

/** Collectifs with a given status, by name. */
export async function listCollectifs(db: Database, status: CollectifStatus): Promise<Collectif[]> {
  return db.findMany(collectifs, { where: { status }, orderBy: ['name', 'asc'] })
}

/** Pending requests made by one person. */
export async function listPendingRequestsBy(db: Database, userId: string): Promise<Collectif[]> {
  return db.findMany(collectifs, {
    where: { requested_by: userId, status: 'pending' },
    orderBy: ['created_at', 'asc'],
  })
}

/** Marks a pending collectif active or rejected, recording who decided. */
export async function decideCollectif(
  db: Database,
  id: string,
  decision: { status: 'active' | 'rejected'; adminId: string; rejectionReason?: string | null },
): Promise<Collectif> {
  return db.update(collectifs, id, {
    status: decision.status,
    validated_by: decision.adminId,
    validated_at: new Date(),
    rejection_reason: decision.rejectionReason ?? null,
    updated_at: new Date(),
  })
}

/** A pending collectif with the name and e-mail of whoever asked for it. */
export interface PendingCollectif {
  id: string
  name: string
  description: string
  contactPhone: string | null
  requesterName: string | null
  requesterEmail: string | null
  createdAt: Date
}

/** Pending collectif requests for the admin queue, oldest first. */
export async function listPendingCollectifs(db: Database): Promise<PendingCollectif[]> {
  const result = await db.exec(sql`
    select c.id, c.name, c.description, c.contact_phone, c.created_at,
           u.name as requester_name, u.email as requester_email
    from collectifs c left join users u on u.id = c.requested_by
    where c.status = 'pending'
    order by c.created_at
  `)
  return (result.rows ?? []).map((row) => ({
    id: String(row.id),
    name: String(row.name),
    description: String(row.description),
    contactPhone: row.contact_phone === null ? null : String(row.contact_phone),
    requesterName: row.requester_name === null ? null : String(row.requester_name),
    requesterEmail: row.requester_email === null ? null : String(row.requester_email),
    createdAt: new Date(String(row.created_at)),
  }))
}

/** Updates the fields a responsible may edit (US-0.3.5); the name stays under admin control. */
export async function updateCollectifProfile(
  db: Database,
  id: string,
  profile: { description: string; contactPhone: string | null },
): Promise<Collectif> {
  return db.update(collectifs, id, {
    description: profile.description,
    contact_phone: profile.contactPhone,
    updated_at: new Date(),
  })
}
