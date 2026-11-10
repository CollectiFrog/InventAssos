import { getCsrfToken } from 'remix/middleware/csrf'
import { redirect } from 'remix/response/redirect'
import { createController } from 'remix/router'

import { logAction } from '../../data/audit-log.ts'
import { locationHoldsItems } from '../../data/items.ts'
import {
  deleteLocation,
  findLocationById,
  findLocationWithOwner,
  listLocationsOwnedBy,
  redactLocation,
} from '../../data/locations.ts'
import { canManageLocation, canSeeFullAddress, isValidatedUser } from '../../permissions.ts'
import { routes } from '../../routes.ts'
import { forbidden, notFound, requireUser } from '../guards.tsx'
import { viewerOf } from '../viewer.ts'
import { LocationPage } from './location-page.tsx'
import { LocationsPage } from './locations-pages.tsx'
import { ownerOptionsFor } from './owners.ts'

/** "Mes lieux" and deletion (US-0.4.1, US-0.4.2). */
export default createController(routes.locations, {
  actions: {
    async index(context) {
      const actor = requireUser(context)
      if (actor instanceof Response) return actor
      if (!isValidatedUser(actor)) return forbidden(context)

      const { db } = context
      const notice = context.session.get('notice')
      return context.render(
        <LocationsPage
          viewer={viewerOf(context)}
          csrfToken={getCsrfToken(context)}
          locations={await listLocationsOwnedBy(db, actor.id, [...actor.managedCollectifIds])}
          canCreate={(await ownerOptionsFor(db, actor)).length > 0}
          notice={typeof notice === 'string' ? notice : undefined}
        />,
      )
    },

    async show(context) {
      const actor = requireUser(context)
      if (actor instanceof Response) return actor
      if (!isValidatedUser(actor)) return forbidden(context)

      const location = await findLocationWithOwner(context.db, context.params.locationId)
      if (location === null) return notFound(context)
      return context.render(
        <LocationPage
          viewer={viewerOf(context)}
          location={redactLocation(location, canSeeFullAddress(actor, location))}
          canManage={canManageLocation(actor, location)}
        />,
      )
    },

    async remove(context) {
      const actor = requireUser(context)
      if (actor instanceof Response) return actor
      const { db, session } = context
      const location = await findLocationById(db, context.params.locationId)
      if (location === null) return notFound(context)
      if (!canManageLocation(actor, location)) return forbidden(context)
      // US-0.4.1: the foreign key also refuses it; this check gives a readable message.
      if (await locationHoldsItems(db, location.id)) {
        session.flash('notice', `« ${location.name} » contient du matériel : déplacez-le d’abord.`)
        return redirect(routes.locations.index.href(), 303)
      }

      await db.transaction(async (tx) => {
        await deleteLocation(tx, location.id)
        await logAction(tx, {
          actorId: actor.id,
          action: 'location.deleted',
          entity: 'location',
          entityId: location.id,
        })
      })
      session.flash('notice', `Lieu « ${location.name} » supprimé.`)
      return redirect(routes.locations.index.href(), 303)
    },
  },
})
