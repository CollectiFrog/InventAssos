import type { Database } from 'remix/data-table'

import { listCollectifs } from '../../data/collectifs.ts'
import type { LocationOwner } from '../../data/locations.ts'
import type { CurrentUser } from '../../middleware/current-user.ts'
import { canManageCollectifLocations, canManagePersonalLocations } from '../../permissions.ts'
import type { OwnerOption } from './location-form.tsx'

/** Owners the actor may create a location for: themselves, then the collectifs they manage. */
export async function ownerOptionsFor(db: Database, actor: CurrentUser): Promise<OwnerOption[]> {
  const collectifs = await listCollectifs(db, 'active')
  const personal = canManagePersonalLocations(actor, actor.id)
    ? [{ value: 'me', label: 'Moi (lieu personnel)' }]
    : []
  return [
    ...personal,
    ...collectifs
      .filter((c) => canManageCollectifLocations(actor, c.id))
      .map((c) => ({ value: `collectif:${c.id}`, label: c.name })),
  ]
}

/** Reads the submitted owner; null when the actor may not create a location for it. */
export function parseOwner(value: string, actor: CurrentUser): LocationOwner | null {
  if (value === 'me')
    return canManagePersonalLocations(actor, actor.id) ? { userId: actor.id } : null
  if (value.startsWith('collectif:')) {
    const collectifId = value.slice('collectif:'.length)
    return canManageCollectifLocations(actor, collectifId) ? { collectifId } : null
  }
  return null
}
