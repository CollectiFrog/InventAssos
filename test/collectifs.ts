// Test fixtures for collectifs.
import type { Database } from 'remix/data-table'

import { createCollectifRequest, decideCollectif } from '../app/data/collectifs.ts'
import { setResponsible } from '../app/data/members.ts'
import type { Collectif } from '../app/data/tables.ts'

/** Creates a pending collectif requested by `requesterId`. */
export async function createPendingCollectif(
  db: Database,
  name: string,
  requesterId: string,
): Promise<Collectif> {
  return createCollectifRequest(db, {
    name,
    city: 'Rennes',
    description: '',
    contactPhone: null,
    requestedBy: requesterId,
  })
}

/** Creates an active collectif whose active responsible is `responsibleId`. */
export async function createActiveCollectif(
  db: Database,
  name: string,
  responsibleId: string,
): Promise<Collectif> {
  const collectif = await createPendingCollectif(db, name, responsibleId)
  await setResponsible(db, { userId: responsibleId, collectifId: collectif.id, status: 'active' })
  return decideCollectif(db, collectif.id, { status: 'active', adminId: responsibleId })
}
