import type { Handle, RemixNode } from 'remix/component'

import type { ItemDetails } from '../../data/items.ts'
import { routes } from '../../routes.ts'
import { conditionLabels, formatEuros } from '../../ui/labels.ts'
import { Layout, type Viewer } from '../../ui/layout.tsx'

/** Props of an item's page. */
export interface ItemPageProps {
  viewer: Viewer
  item: ItemDetails
  /** Whether the viewer may edit, move and archive the item (`canEditItem`). */
  canEdit?: boolean
  /** History section (US-0.5.6). */
  history?: RemixNode
  notice?: string
}

/** An item: what it is, where it is stored (city), who owns it. */
export function ItemPage(handle: Handle<ItemPageProps>) {
  return () => {
    const { viewer, item, canEdit, history, notice } = handle.props
    return (
      <Layout title={item.name} viewer={viewer}>
        <h1>
          {item.name}
          {item.quantity > 1 ? ` × ${item.quantity}` : null}
        </h1>
        {notice ? (
          <p class="notice notice-success" role="status">
            {notice}
          </p>
        ) : null}
        <dl class="facts">
          <dt>Catégorie</dt>
          <dd>{item.categoryName}</dd>
          {item.brand ? (
            <>
              <dt>Marque</dt>
              <dd>{item.brand}</dd>
            </>
          ) : null}
          {item.model ? (
            <>
              <dt>Modèle</dt>
              <dd>{item.model}</dd>
            </>
          ) : null}
          {item.serial_number ? (
            <>
              <dt>Numéro de série</dt>
              <dd>{item.serial_number}</dd>
            </>
          ) : null}
          {item.condition ? (
            <>
              <dt>État</dt>
              <dd>{conditionLabels[item.condition]}</dd>
            </>
          ) : null}
          {item.estimated_value !== null ? (
            <>
              <dt>Valeur estimée</dt>
              <dd>{formatEuros(item.estimated_value)}</dd>
            </>
          ) : null}
          <dt>Rangé à</dt>
          <dd>
            <a href={routes.locations.show.href({ locationId: item.location_id })}>
              {item.locationName}
            </a>{' '}
            · {item.city}
          </dd>
          <dt>Appartient à</dt>
          <dd>
            {item.ownerSlug ? (
              <a href={routes.collectifs.show.href({ slug: item.ownerSlug })}>{item.ownerName}</a>
            ) : (
              item.ownerName
            )}
          </dd>
        </dl>
        {item.description ? <p class="prose">{item.description}</p> : null}
        {canEdit ? (
          <p class="actions">
            <a class="button secondary" href={routes.items.edit.index.href({ itemId: item.id })}>
              Modifier
            </a>
            <a class="button secondary" href={routes.items.move.index.href({ itemId: item.id })}>
              Déplacer
            </a>
          </p>
        ) : null}
        {history}
      </Layout>
    )
  }
}
