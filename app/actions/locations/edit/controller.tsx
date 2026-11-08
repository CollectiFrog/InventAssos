import { getCsrfToken } from 'remix/middleware/csrf'
import { redirect } from 'remix/response/redirect'
import { createController } from 'remix/router'

import { logAction } from '../../../data/audit-log.ts'
import { findLocationById, updateLocation } from '../../../data/locations.ts'
import { canManageLocation } from '../../../permissions.ts'
import { routes } from '../../../routes.ts'
import { formValue, parseForm } from '../../../validation.ts'
import { forbidden, notFound, requireUser } from '../../guards.tsx'
import { viewerOf } from '../../viewer.ts'
import { LocationEditorPage } from '../locations-pages.tsx'
import { locationSchema } from '../schema.ts'

/** Edit a location's name, city, address and notes. */
export default createController(routes.locations.edit, {
  actions: {
    async index(context) {
      const actor = requireUser(context)
      if (actor instanceof Response) return actor
      const location = await findLocationById(context.db, context.params.locationId)
      if (location === null) return notFound(context)
      if (!canManageLocation(actor, location)) return forbidden(context)

      return context.render(
        <LocationEditorPage
          viewer={viewerOf(context)}
          csrfToken={getCsrfToken(context)}
          title={`Modifier « ${location.name} »`}
          action={routes.locations.edit.action.href({ locationId: location.id })}
          values={{
            owner: '',
            name: location.name,
            city: location.city,
            address: location.address ?? '',
            notes: location.notes ?? '',
          }}
          submitLabel="Enregistrer"
        />,
      )
    },

    async action(context) {
      const actor = requireUser(context)
      if (actor instanceof Response) return actor
      const { db, formData, session } = context
      const location = await findLocationById(db, context.params.locationId)
      if (location === null) return notFound(context)
      if (!canManageLocation(actor, location)) return forbidden(context)

      const parsed = parseForm(locationSchema, formData)
      if (!parsed.ok) {
        return context.render(
          <LocationEditorPage
            viewer={viewerOf(context)}
            csrfToken={getCsrfToken(context)}
            title={`Modifier « ${location.name} »`}
            action={routes.locations.edit.action.href({ locationId: location.id })}
            values={{
              owner: '',
              name: formValue(formData, 'name'),
              city: formValue(formData, 'city'),
              address: formValue(formData, 'address'),
              notes: formValue(formData, 'notes'),
            }}
            errors={parsed.errors}
            submitLabel="Enregistrer"
          />,
          { status: 400 },
        )
      }

      await db.transaction(async (tx) => {
        await updateLocation(tx, location.id, parsed.value)
        await logAction(tx, {
          actorId: actor.id,
          action: 'location.updated',
          entity: 'location',
          entityId: location.id,
        })
      })
      session.flash('notice', `Lieu « ${parsed.value.name} » enregistré.`)
      return redirect(routes.locations.index.href(), 303)
    },
  },
})
