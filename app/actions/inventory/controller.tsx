import { createController } from 'remix/router'

import { listInventory } from '../../data/items.ts'
import { isValidatedUser } from '../../permissions.ts'
import { routes } from '../../routes.ts'
import { forbidden, requireUser } from '../guards.tsx'
import { viewerOf } from '../viewer.ts'
import { InventoryPage } from './inventory-page.tsx'

/** Items per page of the inventory. */
export const pageSize = 24

/** Browse the whole inventory (US-0.6.1). */
export default createController(routes.inventory, {
  actions: {
    async index(context) {
      const actor = requireUser(context)
      if (actor instanceof Response) return actor
      if (!isValidatedUser(actor)) return forbidden(context)

      const requested = Number.parseInt(context.url.searchParams.get('page') ?? '1', 10)
      const page = Number.isFinite(requested) && requested > 0 ? requested : 1
      const { items, total } = await listInventory(context.db, { page, pageSize })
      const pageCount = Math.max(1, Math.ceil(total / pageSize))

      return context.render(
        <InventoryPage
          viewer={viewerOf(context)}
          items={items}
          total={total}
          page={Math.min(page, pageCount)}
          pageCount={pageCount}
          hrefFor={(n) => `${routes.inventory.index.href()}?page=${n}`}
        />,
      )
    },
  },
})
