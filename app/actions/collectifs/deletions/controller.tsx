import { redirect } from 'remix/response/redirect'
import { createController } from 'remix/router'

import { logAction } from '../../../data/audit-log.ts'
import { findActiveCollectifBySlug } from '../../../data/collectifs.ts'
import { dropDeletionRequest, hasDeletionRequest } from '../../../data/deletion-requests.ts'
import { deleteItem, findItemById } from '../../../data/items.ts'
import type { AppContext } from '../../../middleware/index.ts'
import { canDecideItemDeletion } from '../../../permissions.ts'
import { routes } from '../../../routes.ts'
import { forbidden, notFound, requireUser } from '../../guards.tsx'

/**
 * A responsible of the owning collectif accepts (the item is deleted for good) or rejects a
 * member's request to delete an item (US-0.8.10). No e-mail: the request lives in the Membres tab.
 */
async function decide(
  context: AppContext,
  params: { slug: string; itemId: string },
  accept: boolean,
) {
  const actor = requireUser(context)
  if (actor instanceof Response) return actor

  const { db, session } = context
  const collectif = await findActiveCollectifBySlug(db, params.slug)
  if (collectif === null) return notFound(context)
  if (!canDecideItemDeletion(actor, collectif.id)) return forbidden(context)

  const membersUrl = routes.collectifs.people.href({ slug: collectif.slug })
  const item = await findItemById(db, params.itemId)
  if (
    item === null ||
    item.owner_collectif_id !== collectif.id ||
    !(await hasDeletionRequest(db, item.id))
  ) {
    session.flash('notice', 'Cette demande a déjà été traitée.')
    return redirect(membersUrl, 303)
  }

  await db.transaction(async (tx) => {
    if (accept) await deleteItem(tx, item.id)
    else await dropDeletionRequest(tx, item.id)
    await logAction(tx, {
      actorId: actor.id,
      action: accept ? 'item.deleted' : 'item.deletion_rejected',
      entity: 'item',
      entityId: item.id,
    })
  })
  session.flash(
    'notice',
    accept ? `« ${item.name} » supprimé.` : `Demande de suppression de « ${item.name} » refusée.`,
  )
  return redirect(membersUrl, 303)
}

export default createController(routes.collectifs.deletions, {
  actions: {
    approve: (context) => decide(context, context.params, true),
    reject: (context) => decide(context, context.params, false),
  },
})
