import type { Handle } from 'remix/component'
import { getCsrfToken } from 'remix/middleware/csrf'
import { redirect } from 'remix/response/redirect'
import { createController } from 'remix/router'

import { logAction } from '../../../data/audit-log.ts'
import {
  deleteItem,
  findItemDetails,
  type ItemDetails,
  listOwnerContactEmails,
} from '../../../data/items.ts'
import { sendSafely } from '../../../mail/mailer.ts'
import { itemDeletedByPlatformMail } from '../../../mail/messages.ts'
import type { AppContext } from '../../../middleware/index.ts'
import {
  canDeleteItem,
  canSeeItem,
  deletesAsPlatform,
  isActiveStaff,
} from '../../../permissions.ts'
import { routes } from '../../../routes.ts'
import { CsrfField, TextArea } from '../../../ui/form.tsx'
import { Layout, type Viewer } from '../../../ui/layout.tsx'
import { formValue } from '../../../validation.ts'
import { itemOwnerAccount } from '../../account-target.ts'
import { forbidden, notFound, requireUser } from '../../guards.tsx'
import { viewerOf } from '../../viewer.ts'

/** Longest reason the platform sends the owner. */
const maxMessage = 1000

interface DeletePageProps {
  viewer: Viewer
  csrfToken: string
  item: ItemDetails
  /** The platform deletes, not the owner: a reason is asked and e-mailed to the owner. */
  asPlatform: boolean
  message?: string
  error?: string
}

/** Confirmation page: a page, not a modal window (ADR 0022). */
function DeleteItemPage(handle: Handle<DeletePageProps>) {
  return () => {
    const { viewer, csrfToken, item, asPlatform, message, error } = handle.props
    return (
      <Layout title={`Supprimer ${item.name}`} viewer={viewer}>
        <h1>Supprimer « {item.name} » ?</h1>
        <p>
          La suppression est définitive : l’objet et son historique disparaissent. Réservez-la au
          matériel saisi par erreur.
        </p>
        <p class="status">
          Vendu, perdu ou cassé ? Archivez-le plutôt : il sort de l’inventaire et garde son
          historique.
        </p>
        <form
          method="post"
          action={routes.items.remove.action.href({ itemId: item.id })}
          class="stack"
        >
          <CsrfField token={csrfToken} />
          {asPlatform ? (
            <TextArea
              name="message"
              label="Message au propriétaire"
              value={message}
              error={error}
              required
              maxLength={maxMessage}
              hint="Envoyé par e-mail au propriétaire : expliquez pourquoi le matériel est supprimé."
            />
          ) : null}
          <p class="actions">
            <button type="submit" class="danger">
              Supprimer définitivement
            </button>
            <a class="button secondary" href={routes.items.show.href({ itemId: item.id })}>
              Annuler
            </a>
          </p>
        </form>
      </Layout>
    )
  }
}

/** Loads the item the actor may delete, or the answer to send instead. */
async function loadItem(context: AppContext, itemId: string) {
  const actor = requireUser(context)
  if (actor instanceof Response) return actor
  const item = await findItemDetails(context.db, itemId)
  // An archived item stays reachable by whoever may delete it (US-0.8.9).
  if (item === null || !canSeeItem(actor, item)) return notFound(context)
  const owner = await itemOwnerAccount(context.db, item, context.settings.adminEmails)
  if (!canDeleteItem(actor, item, owner)) {
    return item.archived_at && !isActiveStaff(actor) ? notFound(context) : forbidden(context)
  }
  return { actor, item, asPlatform: deletesAsPlatform(actor, item) }
}

/**
 * Delete an item entered by mistake (US-0.8.9): its personal owner, a responsible of its owning
 * collectif, an admin or a moderator. When the platform deletes, it gives a reason, e-mailed to
 * the owner and stored nowhere. The audit log keeps its entries, IDs only (ADR 0010).
 */
export default createController(routes.items.remove, {
  actions: {
    async index(context) {
      const loaded = await loadItem(context, context.params.itemId)
      if (loaded instanceof Response) return loaded
      return context.render(
        <DeleteItemPage
          viewer={viewerOf(context)}
          csrfToken={getCsrfToken(context)}
          item={loaded.item}
          asPlatform={loaded.asPlatform}
        />,
      )
    },

    async action(context) {
      const loaded = await loadItem(context, context.params.itemId)
      if (loaded instanceof Response) return loaded
      const { actor, item, asPlatform } = loaded
      const { db, mailer, session } = context

      const message = asPlatform ? formValue(context.formData, 'message').trim() : ''
      const error =
        asPlatform && message === ''
          ? 'Expliquez au propriétaire pourquoi le matériel est supprimé.'
          : message.length > maxMessage
            ? `${maxMessage} caractères au plus.`
            : undefined
      if (error) {
        return context.render(
          <DeleteItemPage
            viewer={viewerOf(context)}
            csrfToken={getCsrfToken(context)}
            item={item}
            asPlatform={asPlatform}
            message={message}
            error={error}
          />,
          { status: 400 },
        )
      }

      // Read before the item goes: afterwards nothing says whom it belonged to.
      const recipients = asPlatform ? await listOwnerContactEmails(db, item) : []
      await db.transaction(async (tx) => {
        await deleteItem(tx, item.id)
        // The message is free text: it is e-mailed, never stored nor logged (ADR 0010).
        await logAction(tx, {
          actorId: actor.id,
          action: 'item.deleted',
          entity: 'item',
          entityId: item.id,
          payload: { byPlatform: asPlatform },
        })
      })
      // One e-mail per responsible: co-responsibles never see each other's address.
      for (const to of recipients) {
        await sendSafely(mailer, itemDeletedByPlatformMail({ to, itemName: item.name, message }))
      }
      session.flash('notice', `« ${item.name} » supprimé.`)
      // Staff land where they can still see something; an owner on their own lists.
      const next = item.ownerSlug
        ? routes.collectifs.show.href({ slug: item.ownerSlug })
        : asPlatform
          ? routes.inventory.index.href()
          : routes.items.index.href()
      return redirect(next, 303)
    },
  },
})
