import type { Handle } from 'remix/component'

import type { InventoryFilters, ItemSummary } from '../../data/items.ts'
import { routes } from '../../routes.ts'
import { SelectField, type SelectOption, TextField } from '../../ui/form.tsx'
import { Layout, type Viewer } from '../../ui/layout.tsx'
import { Pagination } from '../../ui/pagination.tsx'
import { ItemList } from '../items/items-pages.tsx'

/** Props of the inventory page. */
export interface InventoryPageProps {
  viewer: Viewer
  items: ItemSummary[]
  total: number
  page: number
  pageCount: number
  hrefFor: (page: number) => string
  filters: InventoryFilters
  categories: SelectOption[]
  collectifs: SelectOption[]
  cities: SelectOption[]
}

/** The whole inventory of the platform (US-0.6.1). */
export function InventoryPage(handle: Handle<InventoryPageProps>) {
  return () => {
    const {
      viewer,
      items,
      total,
      page,
      pageCount,
      hrefFor,
      filters,
      categories,
      collectifs,
      cities,
    } = handle.props
    const filtered = Boolean(
      filters.query || filters.categoryId || filters.collectifId || filters.city,
    )
    return (
      <Layout title="Inventaire" viewer={viewer}>
        <h1>Inventaire</h1>
        <form
          method="get"
          action={routes.inventory.index.href()}
          class="filters"
          aria-label="Rechercher dans l’inventaire"
        >
          <TextField
            name="q"
            label="Rechercher"
            type="search"
            value={filters.query}
            hint="Nom, marque, modèle ou description."
            maxLength={100}
          />
          <SelectField
            name="categorie"
            label="Catégorie"
            options={categories}
            value={filters.categoryId}
            emptyLabel="Toutes"
          />
          <SelectField
            name="collectif"
            label="Collectif propriétaire"
            options={collectifs}
            value={filters.collectifId}
            emptyLabel="Tous"
          />
          <SelectField
            name="ville"
            label="Ville"
            options={cities}
            value={filters.city}
            emptyLabel="Toutes"
          />
          <div class="actions">
            <button type="submit">Filtrer</button>
            {filtered ? (
              <a class="button secondary" href={routes.inventory.index.href()}>
                Tout afficher
              </a>
            ) : null}
          </div>
        </form>
        <p class="status">
          {total} {total > 1 ? 'objets' : 'objet'}
        </p>
        {items.length === 0 ? <p>Aucun matériel.</p> : <ItemList items={items} />}
        <Pagination page={page} pageCount={pageCount} hrefFor={hrefFor} />
      </Layout>
    )
  }
}
