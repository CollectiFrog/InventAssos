import { createController } from 'remix/router'

import { listCategories } from '../../data/categories.ts'
import { listCollectifs } from '../../data/collectifs.ts'
import { isUuid } from '../../data/ids.ts'
import {
  countVisibleItems,
  type InventoryFilters,
  listInventory,
  listInventoryCities,
} from '../../data/items.ts'
import { isActiveStaff, isValidatedUser, itemScopeOf } from '../../permissions.ts'
import { routes } from '../../routes.ts'
import { type ActiveFilter, parseItemSort, parseItemView, sortParam } from '../../ui/item-table.tsx'
import { forbidden, requireUser } from '../guards.tsx'
import { viewerOf } from '../viewer.ts'
import { InventoryPage } from './inventory-page.tsx'

// Far beyond any real inventory; keeps the SQL offset a small number (review F7).
const maxPage = 10_000

/** Items per page of the inventory. */
export const pageSize = 24

/** Search the equipment of my collectifs (US-0.6.1, US-0.7.11), index template (US-0.7.13). */
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
      const sort = parseItemSort(params.get('tri'))
      const view = parseItemView(params.get('vue'))
      const { db } = context
      const scope = itemScopeOf(actor)
      const { items, total } = await listInventory(db, { scope, page, pageSize, filters, sort })
      const pageCount = Math.max(1, Math.ceil(total / pageSize))
      const counts = await countVisibleItems(db, scope)

      // Same URL with some parameters changed; any change but the page goes back to page 1.
      const hrefWith = (changes: Record<string, string>) => {
        const query = new URLSearchParams(params)
        if (!('page' in changes)) query.delete('page')
        for (const [name, value] of Object.entries(changes)) {
          if (value) query.set(name, value)
          else query.delete(name)
        }
        const search = query.toString()
        return search ? `${routes.inventory.index.href()}?${search}` : routes.inventory.index.href()
      }

      const categories = (await listCategories(db)).map((c) => ({
        value: c.id,
        label: `${c.name} (${counts.byCategory.get(c.id) ?? 0})`,
      }))
      // The collectif filter offers my collectifs only; admins and moderators see them all (ADR 0021).
      const collectifs = (
        isActiveStaff(actor) ? await listCollectifs(db, 'active') : actor.collectifs
      ).map((c) => ({ value: c.id, label: c.name }))
      const cities = (await listInventoryCities(db, scope)).map((city) => ({
        value: city,
        label: `${city} (${counts.byCity.get(city) ?? 0})`,
      }))
      const nameOf = (options: { value: string; label: string }[], value?: string) =>
        options.find((option) => option.value === value)?.label.replace(/ \(\d+\)$/, '') ?? value
      const activeFilters: ActiveFilter[] = [
        filters.query && { label: `« ${filters.query} »`, removeHref: hrefWith({ q: '' }) },
        filters.categoryId && {
          label: `Catégorie : ${nameOf(categories, filters.categoryId)}`,
          removeHref: hrefWith({ categorie: '' }),
        },
        filters.collectifId && {
          label: `Collectif : ${nameOf(collectifs, filters.collectifId)}`,
          removeHref: hrefWith({ collectif: '' }),
        },
        filters.city && { label: `Ville : ${filters.city}`, removeHref: hrefWith({ ville: '' }) },
      ].filter((filter): filter is ActiveFilter => Boolean(filter))

      return context.render(
        <InventoryPage
          viewer={viewerOf(context)}
          items={items}
          total={total}
          page={Math.min(page, pageCount)}
          pageCount={pageCount}
          filters={filters}
          sort={sort}
          sortValue={sortParam(sort)}
          view={view}
          activeFilters={activeFilters}
          hrefWith={hrefWith}
          categories={categories}
          collectifs={collectifs}
          cities={cities}
        />,
      )
    },
  },
})
