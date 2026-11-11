import { getCsrfToken } from 'remix/middleware/csrf'
import { redirect } from 'remix/response/redirect'
import { createController } from 'remix/router'

import { logAction } from '../../../data/audit-log.ts'
import { createLocation } from '../../../data/locations.ts'
import { isValidatedUser } from '../../../permissions.ts'
import { routes } from '../../../routes.ts'
import { formValue, parseForm } from '../../../validation.ts'
import { forbidden, requireUser } from '../../guards.tsx'
import { viewerOf } from '../../viewer.ts'
import { LocationEditorPage } from '../locations-pages.tsx'
import { listPageOf, ownerOptionsFor, parseOwner } from '../owners.ts'
import { locationSchema } from '../schema.ts'

const title = 'Ajouter un lieu'

/** Create a location for a collectif I manage (US-0.4.1) or for myself (US-0.4.2). */
export default createController(routes.locations.create, {
  actions: {
    async index(context) {
      const actor = requireUser(context)
      if (actor instanceof Response) return actor
      if (!isValidatedUser(actor)) return forbidden(context)

      const ownerOptions = await ownerOptionsFor(context.db, actor)
      if (ownerOptions.length === 0) return forbidden(context)
      const preselected = context.url.searchParams.get('pour') ?? ''
      return context.render(
        <LocationEditorPage
          viewer={viewerOf(context)}
          csrfToken={getCsrfToken(context)}
          title={title}
          action={routes.locations.create.action.href()}
          ownerOptions={ownerOptions}
          values={{
            owner: ownerOptions.some((o) => o.value === preselected)
              ? preselected
              : (ownerOptions[0]?.value ?? ''),
            name: '',
            city: '',
            address: '',
            notes: '',
          }}
          submitLabel="Ajouter"
        />,
      )
    },

    async action(context) {
      const actor = requireUser(context)
      if (actor instanceof Response) return actor
      if (!isValidatedUser(actor)) return forbidden(context)

      const { db, formData, session } = context
      const owner = parseOwner(formValue(formData, 'owner'), actor)
      // Deny by default: an owner the actor does not manage is refused, not ignored.
      if (owner === null) return forbidden(context)

      const parsed = parseForm(locationSchema, formData)
      if (!parsed.ok) {
        return context.render(
          <LocationEditorPage
            viewer={viewerOf(context)}
            csrfToken={getCsrfToken(context)}
            title={title}
            action={routes.locations.create.action.href()}
            ownerOptions={await ownerOptionsFor(db, actor)}
            values={{
              owner: formValue(formData, 'owner'),
              name: formValue(formData, 'name'),
              city: formValue(formData, 'city'),
              address: formValue(formData, 'address'),
              notes: formValue(formData, 'notes'),
            }}
            errors={parsed.errors}
            submitLabel="Ajouter"
          />,
          { status: 400 },
        )
      }

      const created = await db.transaction(async (tx) => {
        const location = await createLocation(tx, owner, parsed.value)
        await logAction(tx, {
          actorId: actor.id,
          action: 'location.created',
          entity: 'location',
          entityId: location.id,
          payload:
            'collectifId' in owner ? { collectifId: owner.collectifId } : { userId: owner.userId },
        })
        return location
      })
      session.flash('notice', `Lieu « ${parsed.value.name} » ajouté.`)
      return redirect(await listPageOf(db, created), 303)
    },
  },
})
