import type { Handle } from 'remix/component'

import type { InventoryFilters, ItemSort, ItemSummary } from '../../data/items.ts'
import { routes } from '../../routes.ts'
import type { SelectOption } from '../../ui/form.tsx'
import {
  type ActiveFilter,
  ActiveFilters,
  FilterMenu,
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
  /** `?tri=` of the current sort, kept by a new search; empty for the default. */
  sortValue: string
  view: ItemView
  activeFilters: ActiveFilter[]
  /** The current URL with some parameters changed (and back to page 1, except for `page`). */
  hrefWith: (changes: Record<string, string>) => string
  categories: SelectOption[]
  collectifs: SelectOption[]
  cities: SelectOption[]
}

/** Rechercher (US-0.6.2, US-0.10.21): the search field, filter menus, then the results. */
export function InventoryPage(handle: Handle<InventoryPageProps>) {
  return () => {
    const p = handle.props
    const { filters, items, total } = p
    const menu = (name: string, value: string | undefined, options: SelectOption[]) => ({
      allHref: p.hrefWith({ [name]: '' }),
      options: options.map((option) => ({
        label: option.label,
        href: p.hrefWith({ [name]: option.value }),
        current: option.value === value,
      })),
    })
    return (
      <Layout title="Rechercher" viewer={p.viewer} section="search">
        {/* The navigation already names the page: its title is for screen readers (US-0.10.20). */}
        <h1 class="visually-hidden">Rechercher</h1>
        <search>
          <form method="get" action={routes.inventory.index.href()} class="search-bar">
            <label for="field-q" class="visually-hidden">
              Rechercher dans le matériel
            </label>
            <input
              type="search"
              id="field-q"
              name="q"
              value={filters.query ?? ''}
              placeholder="Nom, marque, modèle ou description…"
              maxLength={100}
            />
            {/* A new search keeps the filters, the view and the sort already chosen. */}
            {filters.categoryId ? (
              <input type="hidden" name="categorie" value={filters.categoryId} />
            ) : null}
            {filters.collectifId ? (
              <input type="hidden" name="collectif" value={filters.collectifId} />
            ) : null}
            {filters.city ? <input type="hidden" name="ville" value={filters.city} /> : null}
            {p.view === 'grille' ? <input type="hidden" name="vue" value="grille" /> : null}
            {p.sortValue ? <input type="hidden" name="tri" value={p.sortValue} /> : null}
            <button type="submit">Rechercher</button>
          </form>
        </search>
        <div class="index-results">
          <nav class="filter-bar" aria-label="Filtres">
            <FilterMenu
              label="Catégorie"
              allLabel="Toutes les catégories"
              {...menu('categorie', filters.categoryId, p.categories)}
            />
            {p.collectifs.length > 0 ? (
              <FilterMenu
                label="Collectif"
                allLabel="Tous les collectifs"
                {...menu('collectif', filters.collectifId, p.collectifs)}
              />
            ) : null}
            <FilterMenu
              label="Ville"
              allLabel="Toutes les villes"
              {...menu('ville', filters.city, p.cities)}
            />
          </nav>
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
      </Layout>
    )
  }
}
