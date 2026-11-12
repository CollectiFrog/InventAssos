import type { Handle } from 'remix/component'
import { getCsrfToken } from 'remix/middleware/csrf'
import { redirect } from 'remix/response/redirect'
import { createController } from 'remix/router'

import { logAction } from '../../../data/audit-log.ts'
import {
  archiveItem,
  findItemDetails,
  type ItemDetails,
  listOwnerContactEmails,
} from '../../../data/items.ts'
import { type ArchiveReason, archiveReasons, ownerArchiveReasons } from '../../../data/tables.ts'
import { sendSafely } from '../../../mail/mailer.ts'
import { itemModeratedMail } from '../../../mail/messages.ts'
import type { AppContext } from '../../../middleware/index.ts'
import {
  type AccountTarget,
  canChangeItem,
  canModerateItem,
  canSeeItem,
} from '../../../permissions.ts'
import { routes } from '../../../routes.ts'
import { CsrfField, type FieldErrors, SelectField, TextArea } from '../../../ui/form.tsx'
import { archiveReasonLabels } from '../../../ui/labels.ts'
import { Layout, type Viewer } from '../../../ui/layout.tsx'
import { formValue } from '../../../validation.ts'
import { itemOwnerAccount } from '../../account-target.ts'
import { forbidden, notFound, requireUser } from '../../guards.tsx'
import { viewerOf } from '../../viewer.ts'

/** Longest message a moderator sends the owner. */
const maxMessage = 1000

interface ArchivePageProps {
  viewer: Viewer
  csrfToken: string
  item: ItemDetails
  /** The reasons this person may give: the owner's, the moderation's, or both. */
  reasons: readonly ArchiveReason[]
  values: Record<string, string>
  errors: FieldErrors
}

/** Confirm the archive with a reason (US-0.5.5), or as a moderation with a message (US-0.8.2). */
function ArchiveItemPage(handle: Handle<ArchivePageProps>) {
  return () => {
    const { viewer, csrfToken, item, reasons, values, errors } = handle.props
    const moderates = reasons.includes('moderated')
    const onlyModerates = moderates && reasons.length === 1
    return (
      <Layout title={`Archiver ${item.name}`} viewer={viewer}>
        <h1>Archiver « {item.name} »</h1>
        <p>
          L’objet sort de l’inventaire mais garde sa page et son historique, visibles par ceux qui
          le gèrent. Il n’est pas supprimé.
        </p>
        <form
          method="post"
          action={routes.items.archive.action.href({ itemId: item.id })}
          class="stack"
        >
          <CsrfField token={csrfToken} />
          <SelectField
            name="reason"
            label="Raison"
            options={reasons.map((value) => ({ value, label: archiveReasonLabels[value] }))}
            value={values.reason ?? (onlyModerates ? 'moderated' : undefined)}
            error={errors.reason}
            required
          />
          {moderates ? (
            <TextArea
              name="message"
              label="Message au propriétaire"
              value={values.message}
              error={errors.message}
              required={onlyModerates}
              maxLength={maxMessage}
              hint={
                onlyModerates
                  ? 'Envoyé par e-mail au propriétaire : expliquez pourquoi le matériel est retiré.'
                  : 'Obligatoire pour « Retiré par la modération » : envoyé par e-mail au propriétaire.'
              }
            />
          ) : null}
          <button type="submit" class="danger">
            Archiver
          </button>
        </form>
        <p>
          <a href={routes.items.show.href({ itemId: item.id })}>Annuler</a>
        </p>
      </Layout>
    )
  }
}

/** The reasons the actor may give for this item; empty when they may not archive it. */
function reasonsFor(
  actor: Parameters<typeof canChangeItem>[0],
  item: ItemDetails,
  owner: AccountTarget | null,
): ArchiveReason[] {
  return [
    ...(canChangeItem(actor, item) ? ownerArchiveReasons : []),
    ...(canModerateItem(actor, item, owner) ? (['moderated'] as const) : []),
  ]
}

/** Loads the item the actor may archive, or the answer to send instead. */
async function loadItem(context: AppContext, itemId: string) {
  const actor = requireUser(context)
  if (actor instanceof Response) return actor
  const item = await findItemDetails(context.db, itemId)
  if (item === null || item.archived_at || !canSeeItem(actor, item)) return notFound(context)
  const owner = await itemOwnerAccount(context.db, item, context.settings.adminEmails)
  const reasons = reasonsFor(actor, item, owner)
  if (reasons.length === 0) return forbidden(context)
  return { actor, item, reasons }
}

/**
 * Archive a sold, lost or broken item: same permission as editing it. Admins and moderators may
 * also archive an abusive item, whose owner is e-mailed their message (US-0.8.2).
 */
export default createController(routes.items.archive, {
  actions: {
    async index(context) {
      const loaded = await loadItem(context, context.params.itemId)
      if (loaded instanceof Response) return loaded
      return context.render(
        <ArchiveItemPage
          viewer={viewerOf(context)}
          csrfToken={getCsrfToken(context)}
          item={loaded.item}
          reasons={loaded.reasons}
          values={{}}
          errors={{}}
        />,
      )
    },

    async action(context) {
      const loaded = await loadItem(context, context.params.itemId)
      if (loaded instanceof Response) return loaded
      const { actor, item, reasons } = loaded
      const { db, formData, mailer, session, settings } = context

      const chosen = formValue(formData, 'reason')
      // A real reason this person may not give is a refusal, not a form error.
      if (archiveReasons.some((value) => value === chosen) && !reasons.some((r) => r === chosen)) {
        return forbidden(context)
      }
      const reason = reasons.find((value) => value === chosen)
      const message = formValue(formData, 'message').trim()
      const errors: FieldErrors = {}
      if (reason === undefined) errors.reason = 'Choisissez une raison.'
      if (reason === 'moderated' && message === '') {
        errors.message = 'Expliquez au propriétaire pourquoi le matériel est retiré.'
      }
      if (message.length > maxMessage) errors.message = `${maxMessage} caractères au plus.`
      if (reason === undefined || Object.keys(errors).length > 0) {
        return context.render(
          <ArchiveItemPage
            viewer={viewerOf(context)}
            csrfToken={getCsrfToken(context)}
            item={item}
            reasons={reasons}
            values={{ reason: chosen, message }}
            errors={errors}
          />,
          { status: 400 },
        )
      }

      await db.transaction(async (tx) => {
        await archiveItem(tx, item.id, reason)
        // The message is free text: it is e-mailed, never stored nor logged (ADR 0010).
        await logAction(tx, {
          actorId: actor.id,
          action: 'item.archived',
          entity: 'item',
          entityId: item.id,
          payload: { reason },
        })
      })
      if (reason === 'moderated') {
        // One e-mail per responsible: co-responsibles never see each other's address.
        for (const to of await listOwnerContactEmails(db, item)) {
          await sendSafely(
            mailer,
            itemModeratedMail({
              to,
              itemName: item.name,
              itemUrl: settings.appUrl + routes.items.show.href({ itemId: item.id }),
              message,
            }),
          )
        }
      }
      session.flash('notice', `« ${item.name} » archivé.`)
      return redirect(routes.items.show.href({ itemId: item.id }), 303)
    },
  },
})
