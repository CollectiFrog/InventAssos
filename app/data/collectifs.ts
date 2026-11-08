// Data access for collectifs: the only module that reads or writes the `collectifs` table.
import { and, type Database, ne } from 'remix/data-table'

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
  return db.find(collectifs, id)
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
