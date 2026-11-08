import type { Handle } from 'remix/component'
import { getCsrfToken } from 'remix/middleware/csrf'
import { redirect } from 'remix/response/redirect'
import { createController } from 'remix/router'

import { logAction } from '../../../data/audit-log.ts'
import { archiveItem, findItemDetails, type ItemDetails } from '../../../data/items.ts'
import { archiveReasons } from '../../../data/tables.ts'
import { canEditItem } from '../../../permissions.ts'
import { routes } from '../../../routes.ts'
import { CsrfField, SelectField } from '../../../ui/form.tsx'
import { archiveReasonLabels } from '../../../ui/labels.ts'
import { Layout, type Viewer } from '../../../ui/layout.tsx'
import { formValue } from '../../../validation.ts'
import { forbidden, notFound, requireUser } from '../../guards.tsx'
import { viewerOf } from '../../viewer.ts'

const reasonOptions = archiveReasons.map((value) => ({ value, label: archiveReasonLabels[value] }))

/** Confirm the archive with a reason (US-0.5.5). */
function ArchiveItemPage(
  handle: Handle<{ viewer: Viewer; csrfToken: string; item: ItemDetails; error?: string }>,
) {
  return () => {
    const { viewer, csrfToken, item, error } = handle.props
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
            options={reasonOptions}
            error={error}
            required
          />
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

/** Archive a sold, lost or broken item: same permission as editing it. */
export default createController(routes.items.archive, {
  actions: {
    async index(context) {
      const actor = requireUser(context)
      if (actor instanceof Response) return actor
      const item = await findItemDetails(context.db, context.params.itemId)
      if (item === null || item.archived_at) return notFound(context)
      if (!canEditItem(actor, item)) return forbidden(context)
      return context.render(
        <ArchiveItemPage
          viewer={viewerOf(context)}
          csrfToken={getCsrfToken(context)}
          item={item}
        />,
      )
    },

    async action(context) {
      const actor = requireUser(context)
      if (actor instanceof Response) return actor
      const { db, formData, session } = context
      const item = await findItemDetails(db, context.params.itemId)
      if (item === null || item.archived_at) return notFound(context)
      if (!canEditItem(actor, item)) return forbidden(context)

      const reason = archiveReasons.find((value) => value === formValue(formData, 'reason'))
      if (reason === undefined) {
        return context.render(
          <ArchiveItemPage
            viewer={viewerOf(context)}
            csrfToken={getCsrfToken(context)}
            item={item}
            error="Choisissez une raison."
          />,
          { status: 400 },
        )
      }

      await db.transaction(async (tx) => {
        await archiveItem(tx, item.id, reason)
        await logAction(tx, {
          actorId: actor.id,
          action: 'item.archived',
          entity: 'item',
          entityId: item.id,
          payload: { reason },
        })
      })
      session.flash('notice', `« ${item.name} » archivé.`)
      return redirect(routes.items.show.href({ itemId: item.id }), 303)
    },
  },
})
