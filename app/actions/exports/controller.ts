import { createController } from 'remix/router'

import { toCsv } from '../../csv.ts'
import { logAction } from '../../data/audit-log.ts'
import { findActiveCollectifBySlug } from '../../data/collectifs.ts'
import { type ItemOwner, listItemsForExport } from '../../data/items.ts'
import type { AppContext } from '../../middleware/index.ts'
import {
  canExportInventoryOf,
  canSeeCollectifInventory,
  isValidatedUser,
  itemScopeOf,
} from '../../permissions.ts'
import { hitExport } from '../../rate-limits.ts'
import { routes } from '../../routes.ts'
import { forbidden, notFound, requireUser, tooManyRequests } from '../guards.tsx'
import { inventoryHeaderRow, inventoryRow } from '../imports/format.ts'

/** Today in Paris, for the file name: 2026-11-12. */
function today(): string {
  return new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris' }).format(new Date())
}

/**
 * Sends an owner's equipment as CSV (US-0.10.4), in the format the import reads (ADR 0026). A POST
 * with the CSRF token, since it writes an audit entry; never cached. The file name is built from a
 * slug (a database constraint keeps it to `a-z0-9-`) and the date, never from a typed name.
 */
async function sendExport(context: AppContext, owner: ItemOwner, fileStem: string) {
  const actor = requireUser(context)
  if (actor instanceof Response) return actor
  if (!isValidatedUser(actor)) return forbidden(context)
  if (!canExportInventoryOf(actor, owner)) {
    // Outside the collectif, 404 as on its pages (ADR 0021); a member of it gets 403.
    const sees = 'userId' in owner || canSeeCollectifInventory(actor, owner.collectifId)
    return sees ? forbidden(context) : notFound(context)
  }
  const limit = await hitExport(context.db, context.settings, actor.id)
  if (!limit.allowed) return tooManyRequests(context, limit.retryAfterSeconds)

  const rows = await listItemsForExport(context.db, owner, itemScopeOf(actor))
  await logAction(context.db, {
    actorId: actor.id,
    action: 'inventory.exported',
    entity: 'collectifId' in owner ? 'collectif' : 'user',
    entityId: 'collectifId' in owner ? owner.collectifId : owner.userId,
    payload: { items: rows.length },
  })
  const csv = toCsv([inventoryHeaderRow(), ...rows.map(inventoryRow)])
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${fileStem}-${today()}.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}

/** Export a collectif's equipment (its responsibles, admins) or one's own (US-0.10.4). */
export default createController(routes.exports, {
  actions: {
    async collectif(context) {
      // Signed in first: a visitor must not learn which collectifs exist from 404 vs 303.
      const actor = requireUser(context)
      if (actor instanceof Response) return actor
      const collectif = await findActiveCollectifBySlug(context.db, context.params.slug)
      if (collectif === null) return notFound(context)
      return sendExport(context, { collectifId: collectif.id }, `inventaire-${collectif.slug}`)
    },

    mine(context) {
      const actor = requireUser(context)
      if (actor instanceof Response) return actor
      return sendExport(context, { userId: actor.id }, 'mon-materiel')
    },
  },
})
