import { createController } from 'remix/router'

import { findItemDetails, listItemsManagedBy } from '../../data/items.ts'
import { canEditItem, isValidatedUser } from '../../permissions.ts'
import { routes } from '../../routes.ts'
import { forbidden, notFound, requireUser } from '../guards.tsx'
import { viewerOf } from '../viewer.ts'
import { storableLocations } from './choices.ts'
import { ItemPage } from './item-page.tsx'
import { MyItemsPage } from './items-pages.tsx'

/** "Mon matériel" and the item page. */
export default createController(routes.items, {
  actions: {
    async index(context) {
      const actor = requireUser(context)
      if (actor instanceof Response) return actor
      if (!isValidatedUser(actor)) return forbidden(context)

      const { db } = context
      const notice = context.session.get('notice')
      return context.render(
        <MyItemsPage
          viewer={viewerOf(context)}
          items={await listItemsManagedBy(db, actor.id, [...actor.managedCollectifIds])}
          canAdd={(await storableLocations(db, actor)).length > 0}
          notice={typeof notice === 'string' ? notice : undefined}
        />,
      )
    },

    async show(context) {
      const actor = requireUser(context)
      if (actor instanceof Response) return actor
      if (!isValidatedUser(actor)) return forbidden(context)

      const item = await findItemDetails(context.db, context.params.itemId)
      // An archived item stays visible to those who manage it, for its history (US-0.5.5).
      if (item === null || (item.archived_at && !canEditItem(actor, item))) return notFound(context)
      const notice = context.session.get('notice')
      return context.render(
        <ItemPage
          viewer={viewerOf(context)}
          item={item}
          canEdit={canEditItem(actor, item)}
          notice={typeof notice === 'string' ? notice : undefined}
        />,
      )
    },
  },
})
