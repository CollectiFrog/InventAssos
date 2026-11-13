import type { Handle } from 'remix/component'
import { getCsrfToken } from 'remix/middleware/csrf'
import { redirect } from 'remix/response/redirect'
import { createController } from 'remix/router'

import { logAction } from '../../../data/audit-log.ts'
import { findItemDetails, type ItemDetails, moveItem } from '../../../data/items.ts'
import { findLocationById } from '../../../data/locations.ts'
import { canChangeItem, canSeeItem, canStoreItemsIn } from '../../../permissions.ts'
import { routes } from '../../../routes.ts'
import { CsrfField, SelectField, type SelectOption } from '../../../ui/form.tsx'
import { Layout, type Viewer } from '../../../ui/layout.tsx'
import { formValue } from '../../../validation.ts'
import { forbidden, notFound, requireUser } from '../../guards.tsx'
import { viewerOf } from '../../viewer.ts'
import { storableLocations } from '../choices.ts'

/** Choose the new location of an item (US-0.5.4). */
function MoveItemPage(
  handle: Handle<{
    viewer: Viewer
    csrfToken: string
    item: ItemDetails
    locations: SelectOption[]
  }>,
) {
  return () => {
    const { viewer, csrfToken, item, locations } = handle.props
    return (
      <Layout title={`Déplacer ${item.name}`} viewer={viewer}>
        <h1>Déplacer « {item.name} »</h1>
        <p>
          Actuellement rangé à <strong>{item.locationName}</strong> ({item.city}).
        </p>
        {locations.length === 0 ? (
          <p>Vous ne gérez aucun autre lieu où le ranger.</p>
        ) : (
          <form
            method="post"
            action={routes.items.move.action.href({ itemId: item.id })}
            class="stack"
          >
            <CsrfField token={csrfToken} />
            <SelectField name="locationId" label="Nouveau lieu" options={locations} required />
            <button type="submit">Déplacer</button>
          </form>
        )}
        <p>
          <a href={routes.items.show.href({ itemId: item.id })}>Annuler</a>
        </p>
      </Layout>
    )
  }
}

/** Move an item to another location the actor manages (US-0.5.4). */
export default createController(routes.items.move, {
  actions: {
    async index(context) {
      const actor = requireUser(context)
      if (actor instanceof Response) return actor
      const item = await findItemDetails(context.db, context.params.itemId)
      if (item === null || item.archived_at || !canSeeItem(actor, item)) return notFound(context)
      if (!canChangeItem(actor, item)) return forbidden(context)

      const locations = (await storableLocations(context.db, actor)).filter(
        (option) => option.value !== item.location_id,
      )
      return context.render(
        <MoveItemPage
          viewer={viewerOf(context)}
          csrfToken={getCsrfToken(context)}
          item={item}
          locations={locations}
        />,
      )
    },

    async action(context) {
      const actor = requireUser(context)
      if (actor instanceof Response) return actor
      const { db, formData, session } = context
      const item = await findItemDetails(db, context.params.itemId)
      if (item === null || item.archived_at || !canSeeItem(actor, item)) return notFound(context)
      // Two rules: may edit the item, and may put items in the target location.
      if (!canChangeItem(actor, item)) return forbidden(context)
      const target = await findLocationById(db, formValue(formData, 'locationId'))
      if (target === null || !canStoreItemsIn(actor, target)) return forbidden(context)
      if (target.id === item.location_id) {
        return redirect(routes.items.show.href({ itemId: item.id }), 303)
      }

      await db.transaction(async (tx) => {
        await moveItem(tx, item.id, target.id)
        await logAction(tx, {
          actorId: actor.id,
          action: 'item.moved',
          entity: 'item',
          entityId: item.id,
          payload: { fromLocationId: item.location_id, toLocationId: target.id },
        })
      })
      session.flash('notice', `Déplacé vers « ${target.name} ».`)
      return redirect(routes.items.show.href({ itemId: item.id }), 303)
    },
  },
})
