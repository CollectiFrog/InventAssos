import type { Database } from 'remix/data-table'

import { listCollectifs } from '../../data/collectifs.ts'
import type { ItemOwner } from '../../data/items.ts'
import { listAllLocations, listLocationsOwnedBy } from '../../data/locations.ts'
import type { CurrentUser } from '../../middleware/current-user.ts'
import { canAssignItemOwner, canStoreItemsIn } from '../../permissions.ts'
import type { SelectOption } from '../../ui/form.tsx'

/** Locations the actor may put items in, labelled "name · city (owner)". */
export async function storableLocations(db: Database, actor: CurrentUser): Promise<SelectOption[]> {
  const candidates = actor.isAdmin
    ? await listAllLocations(db)
    : await listLocationsOwnedBy(db, actor.id, [...actor.managedCollectifIds])
  return candidates
    .filter((location) => canStoreItemsIn(actor, location))
    .map((location) => ({
      value: location.id,
      label: `${location.name} · ${location.city} (${location.ownerName})`,
    }))
}

/** Owners the actor may give an item: themselves, then the collectifs they manage. */
export async function ownerOptions(db: Database, actor: CurrentUser): Promise<SelectOption[]> {
  const collectifs = (await listCollectifs(db, 'active')).filter((c) =>
    canAssignItemOwner(actor, { collectifId: c.id }),
  )
  const canDeposit = actor.isAdmin || actor.managedCollectifIds.size > 0
  return [
    { value: 'me', label: 'Moi' },
    ...collectifs.map((c) => ({ value: `collectif:${c.id}`, label: c.name })),
    ...(canDeposit
      ? [{ value: 'person', label: 'Une autre personne (dépôt au local du collectif)' }]
      : []),
  ]
}

/** Reads the submitted owner; null when the actor may not choose it. */
export function parseItemOwner(value: string, actor: CurrentUser): ItemOwner | null {
  const owner: ItemOwner | null =
    value === 'me'
      ? { userId: actor.id }
      : value.startsWith('collectif:')
        ? { collectifId: value.slice('collectif:'.length) }
        : null
  return owner !== null && canAssignItemOwner(actor, owner) ? owner : null
}
