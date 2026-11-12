import * as f from 'remix/data-schema/form-data'
import { getCsrfToken } from 'remix/middleware/csrf'
import { redirect } from 'remix/response/redirect'
import { createController } from 'remix/router'
import { logAction, readHistory } from '../../data/audit-log.ts'
import { hasDeletionRequest, requestItemDeletion } from '../../data/deletion-requests.ts'
import {
  findItemDetails,
  type ItemDetails,
  type ItemSummary,
  listItemsStoredAtHomeOf,
  listOwnerContactEmails,
} from '../../data/items.ts'
import { sendSafely } from '../../mail/mailer.ts'
import { itemContactMail } from '../../mail/messages.ts'
import type { CurrentUser } from '../../middleware/current-user.ts'
import {
  canDeleteItem,
  canEditItem,
  canModerateItem,
  canRequestItemDeletion,
  canSeeItem,
  canSeePerson,
  isActiveStaff,
  isValidatedUser,
} from '../../permissions.ts'
import { hitContact } from '../../rate-limits.ts'
import { routes } from '../../routes.ts'
import { optionalText, parseForm } from '../../validation.ts'
import { backHref } from '../back-link.ts'
import { forbidden, notFound, requireUser, tooManyRequests } from '../guards.tsx'
import { viewerOf } from '../viewer.ts'
import { ItemHistory, itemHistoryActions } from './history.tsx'
import { ItemPage } from './item-page.tsx'
import { MyItemsPage } from './items-pages.tsx'

const contactSchema = f.object({ message: f.field(optionalText(2000)) })

/** True when the item belongs to the viewer or to a collectif they manage: no one to contact. */
function ownsItem(actor: CurrentUser, item: ItemDetails): boolean {
  return (
    item.owner_user_id === actor.id ||
    (item.owner_collectif_id !== null && actor.managedCollectifIds.has(item.owner_collectif_id))
  )
}

/** The item as this viewer may see it: a person owner's phone and page only if they may see them. */
function shownTo(actor: CurrentUser, item: ItemDetails): ItemDetails {
  if (item.owner_user_id === null) return item
  const person = { id: item.owner_user_id, collectifIds: item.ownerCollectifIds }
  return canSeePerson(actor, person) ? item : { ...item, ownerUserId: null, contactPhone: null }
}

/** A flash value when it is text. */
function stringOrUndefined(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

/** "Mon matériel", the item page and its contact form. */
export default createController(routes.items, {
  actions: {
    async index(context) {
      const actor = requireUser(context)
      if (actor instanceof Response) return actor
      if (!isValidatedUser(actor)) return forbidden(context)

      // US-0.7.3: what is stored at my places right now, grouped by whom it belongs to.
      const held = await listItemsStoredAtHomeOf(context.db, actor.id)
      const ofMyCollectifs = (item: ItemSummary) =>
        item.ownerCollectifId !== null && actor.memberCollectifIds.has(item.ownerCollectifId)
      const notice = context.session.get('notice')
      return context.render(
        <MyItemsPage
          viewer={viewerOf(context)}
          mine={held.filter((item) => item.ownerUserId === actor.id)}
          collectifs={held.filter(ofMyCollectifs)}
          borrowed={held.filter((item) => item.ownerUserId !== actor.id && !ofMyCollectifs(item))}
          notice={typeof notice === 'string' ? notice : undefined}
        />,
      )
    },

    async show(context) {
      const actor = requireUser(context)
      if (actor instanceof Response) return actor
      if (!isValidatedUser(actor)) return forbidden(context)

      const item = await findItemDetails(context.db, context.params.itemId)
      // 404 rather than 403, so that an item's existence does not leak (ADR 0021). An archived
      // item stays visible to those who manage it, for its history (US-0.5.5), and to the staff
      // who may have archived it (US-0.8.2).
      if (item === null || !canSeeItem(actor, item)) return notFound(context)
      if (item.archived_at && !canEditItem(actor, item) && !isActiveStaff(actor)) {
        return notFound(context)
      }
      const notice = context.session.get('notice')
      return context.render(
        <ItemPage
          viewer={viewerOf(context)}
          item={shownTo(actor, item)}
          back={backHref(
            context,
            item.ownerSlug
              ? routes.collectifs.show.href({ slug: item.ownerSlug })
              : routes.inventory.index.href(),
          )}
          canEdit={canEditItem(actor, item)}
          canModerate={canModerateItem(actor, item)}
          canDelete={canDeleteItem(actor, item)}
          deletion={
            canRequestItemDeletion(actor, item)
              ? {
                  csrfToken: getCsrfToken(context),
                  requested: await hasDeletionRequest(context.db, item.id),
                }
              : undefined
          }
          contact={
            ownsItem(actor, item)
              ? undefined
              : {
                  csrfToken: getCsrfToken(context),
                  sent: context.session.get('contactSent') === true,
                  error: stringOrUndefined(context.session.get('contactError')),
                }
          }
          history={
            <ItemHistory
              entries={await readHistory(context.db, 'item', item.id, itemHistoryActions)}
            />
          }
          notice={typeof notice === 'string' ? notice : undefined}
        />,
      )
    },

    // US-0.8.10: a member asks C's responsibles to delete one of C's items; no e-mail is sent.
    async requestDeletion(context) {
      const actor = requireUser(context)
      if (actor instanceof Response) return actor
      if (!isValidatedUser(actor)) return forbidden(context)

      const { db, session } = context
      const item = await findItemDetails(db, context.params.itemId)
      if (item === null || !canSeeItem(actor, item)) return notFound(context)
      if (!canRequestItemDeletion(actor, item)) return forbidden(context)

      const showUrl = routes.items.show.href({ itemId: item.id })
      const recorded = await db.transaction(async (tx) => {
        const created = await requestItemDeletion(tx, item.id, actor.id)
        if (created) {
          await logAction(tx, {
            actorId: actor.id,
            action: 'item.deletion_requested',
            entity: 'item',
            entityId: item.id,
          })
        }
        return created
      })
      session.flash(
        'notice',
        recorded
          ? 'Demande envoyée : un responsable du collectif va l’examiner.'
          : 'La suppression de cet objet est déjà demandée.',
      )
      return redirect(showUrl, 303)
    },

    // US-0.6.3: e-mails the owner without showing their address; the sender's goes in Reply-To.
    async contact(context) {
      const actor = requireUser(context)
      if (actor instanceof Response) return actor
      if (!isValidatedUser(actor)) return forbidden(context)

      const { db, mailer, settings, session } = context
      const item = await findItemDetails(db, context.params.itemId)
      if (item === null || item.archived_at || !canSeeItem(actor, item)) return notFound(context)
      const showUrl = routes.items.show.href({ itemId: item.id })
      if (ownsItem(actor, item)) return redirect(showUrl, 303)
      const limit = await hitContact(db, settings, actor.id)
      if (!limit.allowed) return tooManyRequests(context, limit.retryAfterSeconds)

      const parsed = parseForm(contactSchema, context.formData)
      if (!parsed.ok || parsed.value.message === null) {
        // Shown under the message field, like every field error (US-0.7.7).
        session.flash('contactError', 'Écrivez un message avant d’envoyer.')
        return redirect(`${showUrl}#ecrire`, 303)
      }
      // One e-mail per responsible: co-responsibles never see each other's address.
      for (const to of await listOwnerContactEmails(db, item)) {
        await sendSafely(
          mailer,
          itemContactMail({
            to,
            senderName: actor.name,
            senderEmail: actor.email,
            itemName: item.name,
            itemUrl: settings.appUrl + showUrl,
            message: parsed.value.message,
          }),
        )
      }
      // Who wrote about what, IDs only, for an admin reading the log; never shown on the item page.
      await logAction(db, {
        actorId: actor.id,
        action: 'item.contacted',
        entity: 'item',
        entityId: item.id,
      })
      session.flash('contactSent', true)
      return redirect(`${showUrl}#ecrire`, 303)
    },
  },
})
