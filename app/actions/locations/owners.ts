import type { Database } from 'remix/data-table'

import { listCollectifs } from '../../data/collectifs.ts'
import type { LocationOwner } from '../../data/locations.ts'
import type { CurrentUser } from '../../middleware/current-user.ts'
import { canManageCollectifLocations } from '../../permissions.ts'
import type { OwnerOption } from './location-form.tsx'

/** Owners the actor may create a location for: the collectifs they manage (all, for an admin). */
export async function ownerOptionsFor(db: Database, actor: CurrentUser): Promise<OwnerOption[]> {
  const collectifs = await listCollectifs(db, 'active')
  return collectifs
    .filter((c) => canManageCollectifLocations(actor, c.id))
    .map((c) => ({ value: `collectif:${c.id}`, label: c.name }))
}

/** Reads the submitted owner; null when the actor may not create a location for it. */
export function parseOwner(value: string, actor: CurrentUser): LocationOwner | null {
  if (value.startsWith('collectif:')) {
    const collectifId = value.slice('collectif:'.length)
    return canManageCollectifLocations(actor, collectifId) ? { collectifId } : null
  }
  return null
}
