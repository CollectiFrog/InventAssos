import type { Handle } from 'remix/component'

import { type ItemSort, type ItemSummary, itemSortColumns } from '../data/items.ts'
import { routes } from '../routes.ts'

/** How a list of items shows: a dense table (default on computers) or cards (ADR 0022). */
export type ItemView = 'liste' | 'grille'

/** Reads `?vue=`; anything but "grille" is the table. */
export function parseItemView(value: string | null): ItemView {
  return value === 'grille' ? 'grille' : 'liste'
}

/** Reads `?tri=`: a column name, "-" in front for descending; by name otherwise. */
export function parseItemSort(value: string | null): ItemSort {
  const descending = value?.startsWith('-') ?? false
  const name = descending ? value?.slice(1) : value
  const column = itemSortColumns.find((candidate) => candidate === name) ?? 'nom'
  return { column, descending: column === name && descending }
}

/** The `?tri=` value of a sort; empty for the default (by name, ascending). */
export function sortParam(sort: ItemSort): string {
  if (sort.column === 'nom' && !sort.descending) return ''
  return `${sort.descending ? '-' : ''}${sort.column}`
}

const headers: { column: ItemSort['column']; label: string; numeric?: boolean }[] = [
  { column: 'nom', label: 'Nom' },
  { column: 'categorie', label: 'Catégorie' },
  { column: 'quantite', label: 'Qté', numeric: true },
  { column: 'ville', label: 'Ville' },
  { column: 'proprietaire', label: 'Propriétaire' },
]

/** Props of the items table. */
export interface ItemTableProps {
  items: ItemSummary[]
  caption: string
  sort: ItemSort
  /** URL of the same list sorted otherwise. */
  sortHref: (sort: ItemSort) => string
}

/**
 * Items as a dense table whose headers sort it (links, no JavaScript). When its container is
 * narrow, each row becomes a card (styles.css), so phones keep the cards of ui.md.
 */
export function ItemTable(handle: Handle<ItemTableProps>) {
  return () => {
    const { items, caption, sort, sortHref } = handle.props
    return (
      <table class="data-table">
        <caption class="visually-hidden">{caption}</caption>
        <thead>
          <tr>
            {headers.map((header) => {
              const current = sort.column === header.column
              const next = { column: header.column, descending: current && !sort.descending }
              return (
                <th
                  scope="col"
                  class={header.numeric ? 'num' : undefined}
                  aria-sort={current ? (sort.descending ? 'descending' : 'ascending') : undefined}
                >
                  <a href={sortHref(next)}>
                    {header.label}
                    <span aria-hidden="true">{current ? (sort.descending ? ' ↓' : ' ↑') : ''}</span>
                  </a>
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td data-label="Nom" class="cell-name">
                <a href={routes.items.show.href({ itemId: item.id })}>
                  <strong>{item.name}</strong>
                </a>
              </td>
              <td data-label="Catégorie">{item.categoryName}</td>
              <td data-label="Quantité" class="num">
                {item.quantity}
              </td>
              <td data-label="Ville">{item.city}</td>
              <td data-label="Propriétaire">{item.ownerName}</td>
            </tr>
          ))}
        </tbody>
      </table>
    )
  }
}

/** « Liste | Grille », as two links keeping the rest of the URL. */
export function ViewSwitch(
  handle: Handle<{ view: ItemView; hrefFor: (view: ItemView) => string }>,
) {
  return () => {
    const { view, hrefFor } = handle.props
    return (
      <nav aria-label="Affichage" class="view-switch">
        <a href={hrefFor('liste')} aria-current={view === 'liste' ? 'page' : undefined}>
          Liste
        </a>
        <a href={hrefFor('grille')} aria-current={view === 'grille' ? 'page' : undefined}>
          Grille
        </a>
      </nav>
    )
  }
}

/** One active filter, as a link that removes it (ADR 0022). */
export interface ActiveFilter {
  label: string
  removeHref: string
}

/** The active filters, each removable, then « Tout effacer ». */
export function ActiveFilters(handle: Handle<{ filters: ActiveFilter[]; clearHref: string }>) {
  return () => {
    const { filters, clearHref } = handle.props
    if (filters.length === 0) return null
    return (
      <ul class="chips" aria-label="Filtres actifs">
        {filters.map((filter) => (
          <li>
            <a
              class="chip"
              href={filter.removeHref}
              aria-label={`Retirer le filtre ${filter.label}`}
            >
              {filter.label}
              <span aria-hidden="true"> ✕</span>
            </a>
          </li>
        ))}
        <li>
          <a href={clearHref}>Tout effacer</a>
        </li>
      </ul>
    )
  }
}
