import type { Handle } from 'remix/component'

import type { InventoryFilters, ItemSort, ItemSummary } from '../../data/items.ts'
import { routes } from '../../routes.ts'
import { SelectField, type SelectOption, TextField } from '../../ui/form.tsx'
import {
  type ActiveFilter,
  ActiveFilters,
  ItemTable,
  type ItemView,
  ViewSwitch,
} from '../../ui/item-table.tsx'
import { Layout, type Viewer } from '../../ui/layout.tsx'
import { Pagination } from '../../ui/pagination.tsx'
import { ItemList } from '../items/items-pages.tsx'

/** Props of Rechercher. */
export interface InventoryPageProps {
  viewer: Viewer
  items: ItemSummary[]
  total: number
  page: number
  pageCount: number
  filters: InventoryFilters
  sort: ItemSort
  /** `?tri=` of the current sort, kept when the filters are applied; empty for the default. */
  sortValue: string
  view: ItemView
  activeFilters: ActiveFilter[]
  /** The current URL with some parameters changed (and back to page 1, except for `page`). */
  hrefWith: (changes: Record<string, string>) => string
  categories: SelectOption[]
  collectifs: SelectOption[]
  cities: SelectOption[]
}

/** Rechercher (US-0.6.2, US-0.7.13), index template: filters on the left, then the results. */
export function InventoryPage(handle: Handle<InventoryPageProps>) {
  return () => {
    const p = handle.props
    const { filters, items, total } = p
    return (
      <Layout title="Rechercher" viewer={p.viewer} section="search">
        <div class="page-head">
          <div>
            <h1>Rechercher</h1>
            <p class="status">
              Le matériel de vos collectifs, le vôtre et celui rangé dans vos lieux.
            </p>
          </div>
        </div>
        <div class="index">
          <aside class="index-filters">
            <form
              method="get"
              action={routes.inventory.index.href()}
              class="filter-form"
              aria-label="Filtres"
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
                options={p.categories}
                value={filters.categoryId}
                emptyLabel="Toutes"
              />
              <SelectField
                name="collectif"
                label="Collectif propriétaire"
                options={p.collectifs}
                value={filters.collectifId}
                emptyLabel="Tous"
              />
              <SelectField
                name="ville"
                label="Ville"
                options={p.cities}
                value={filters.city}
                emptyLabel="Toutes"
              />
              {p.view === 'grille' ? <input type="hidden" name="vue" value="grille" /> : null}
              {p.sortValue ? <input type="hidden" name="tri" value={p.sortValue} /> : null}
              <button type="submit">Appliquer</button>
            </form>
          </aside>
          <div class="index-results">
            <div class="results-bar">
              <p class="status" role="status">
                {total} {total > 1 ? 'objets' : 'objet'}
              </p>
              <ActiveFilters
                filters={p.activeFilters}
                clearHref={p.hrefWith({ q: '', categorie: '', collectif: '', ville: '' })}
              />
              <ViewSwitch
                view={p.view}
                hrefFor={(view) => p.hrefWith({ vue: view === 'grille' ? 'grille' : '' })}
              />
            </div>
            {items.length === 0 ? (
              p.activeFilters.length > 0 ? (
                <div class="card empty-state">
                  <p>Aucun objet ne correspond à cette recherche.</p>
                  <a class="button secondary" href={routes.inventory.index.href()}>
                    Tout afficher
                  </a>
                </div>
              ) : (
                <div class="card empty-state">
                  <p>
                    Rien à afficher pour l’instant : vous voyez le matériel de vos collectifs, le
                    vôtre et celui rangé chez vous.
                  </p>
                  <p class="actions">
                    <a class="button" href={routes.items.create.index.href()}>
                      Ajouter du matériel
                    </a>
                    <a class="button secondary" href={routes.collectifs.index.href()}>
                      Voir les collectifs
                    </a>
                  </p>
                </div>
              )
            ) : p.view === 'grille' ? (
              <ItemList items={items} grid />
            ) : (
              <ItemTable
                items={items}
                caption="Résultats de la recherche"
                sort={p.sort}
                sortHref={(sort) =>
                  p.hrefWith({ tri: `${sort.descending ? '-' : ''}${sort.column}` })
                }
              />
            )}
            <Pagination
              page={p.page}
              pageCount={p.pageCount}
              hrefFor={(n) => p.hrefWith({ page: String(n) })}
            />
          </div>
        </div>
      </Layout>
    )
  }
}
