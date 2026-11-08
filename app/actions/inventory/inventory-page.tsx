import type { Handle } from 'remix/component'

import type { ItemSummary } from '../../data/items.ts'
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
}

/** The whole inventory of the platform (US-0.6.1). */
export function InventoryPage(handle: Handle<InventoryPageProps>) {
  return () => {
    const { viewer, items, total, page, pageCount, hrefFor } = handle.props
    return (
      <Layout title="Inventaire" viewer={viewer}>
        <h1>Inventaire</h1>
        <p class="status">
          {total} {total > 1 ? 'objets' : 'objet'}
        </p>
        {items.length === 0 ? <p>Aucun matériel.</p> : <ItemList items={items} />}
        <Pagination page={page} pageCount={pageCount} hrefFor={hrefFor} />
      </Layout>
    )
  }
}
