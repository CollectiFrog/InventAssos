import type { Handle } from 'remix/component'

/** Props of the pagination links. */
export interface PaginationProps {
  page: number
  pageCount: number
  /** Builds the URL of a page, keeping the other query parameters. */
  hrefFor: (page: number) => string
}

/** "Précédent · Page 2 sur 5 · Suivant", as plain links (works without JavaScript). */
export function Pagination(handle: Handle<PaginationProps>) {
  return () => {
    const { page, pageCount, hrefFor } = handle.props
    if (pageCount <= 1) return null
    return (
      <nav aria-label="Pagination" class="pagination">
        {page > 1 ? (
          <a href={hrefFor(page - 1)} rel="prev">
            ← Précédent
          </a>
        ) : (
          <span />
        )}
        <span>
          Page {page} sur {pageCount}
        </span>
        {page < pageCount ? (
          <a href={hrefFor(page + 1)} rel="next">
            Suivant →
          </a>
        ) : (
          <span />
        )}
      </nav>
    )
  }
}
