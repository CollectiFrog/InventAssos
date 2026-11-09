import { createController } from 'remix/router'

import { listCollectifs } from '../../data/collectifs.ts'
import { isUuid } from '../../data/ids.ts'
import {
  type InventoryFilters,
  listCategories,
  listInventory,
  listInventoryCities,
} from '../../data/items.ts'
import { isValidatedUser } from '../../permissions.ts'
import { routes } from '../../routes.ts'
import { forbidden, requireUser } from '../guards.tsx'
import { viewerOf } from '../viewer.ts'
import { InventoryPage } from './inventory-page.tsx'

// Far beyond any real inventory; keeps the SQL offset a small number (review F7).
const maxPage = 10_000

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
      const page = Number.isFinite(requested) && requested > 0 ? Math.min(requested, maxPage) : 1
      const params = context.url.searchParams
      const read = (name: string) => params.get(name)?.trim().slice(0, 100) || undefined
      const filters: InventoryFilters = {
        query: read('q'),
        categoryId: read('categorie'),
        collectifId: isUuid(read('collectif') ?? '') ? read('collectif') : undefined,
        city: read('ville'),
      }
      const { db } = context
      const { items, total } = await listInventory(db, { page, pageSize, filters })
      const pageCount = Math.max(1, Math.ceil(total / pageSize))

      return context.render(
        <InventoryPage
          viewer={viewerOf(context)}
          items={items}
          total={total}
          page={Math.min(page, pageCount)}
          pageCount={pageCount}
          hrefFor={(n) => {
            // Keep the search and filters in the pagination links.
            const query = new URLSearchParams(params)
            query.set('page', String(n))
            return `${routes.inventory.index.href()}?${query}`
          }}
          filters={filters}
          categories={(await listCategories(db)).map((c) => ({ value: c.id, label: c.name }))}
          collectifs={(await listCollectifs(db, 'active')).map((c) => ({
            value: c.id,
            label: c.name,
          }))}
          cities={(await listInventoryCities(db)).map((city) => ({ value: city, label: city }))}
        />,
      )
    },
  },
})
