import type { Handle } from 'remix/component'

import type { ItemSummary } from '../../data/items.ts'
import { routes } from '../../routes.ts'
import {
  CsrfField,
  ErrorSummary,
  type FieldErrors,
  SelectField,
  type SelectOption,
  TextField,
} from '../../ui/form.tsx'
import { Layout, type Viewer } from '../../ui/layout.tsx'
import { ItemFields } from './item-fields.tsx'
import type { ItemFormValues } from './schema.ts'

/** "Mon matériel": the items the viewer owns or stores. */
export function MyItemsPage(
  handle: Handle<{ viewer: Viewer; items: ItemSummary[]; canAdd: boolean; notice?: string }>,
) {
  return () => {
    const { viewer, items, canAdd, notice } = handle.props
    return (
      <Layout title="Mon matériel" viewer={viewer} section="mine">
        <h1>Mon matériel</h1>
        {notice ? (
          <p class="notice notice-success" role="status">
            {notice}
          </p>
        ) : null}
        {canAdd ? (
          <p class="actions">
            <a class="button" href={routes.items.create.index.href()}>
              Ajouter du matériel
            </a>
            <a class="button secondary" href={routes.locations.index.href()}>
              Mes lieux
            </a>
          </p>
        ) : (
          <p class="status">
            Déclarez d’abord un lieu de stockage dans{' '}
            <a href={routes.locations.index.href()}>Mes lieux</a>.
          </p>
        )}
        {items.length === 0 ? <p>Aucun matériel pour l’instant.</p> : <ItemList items={items} />}
      </Layout>
    )
  }
}

/** A list of item summaries linking to their pages. */
export function ItemList(handle: Handle<{ items: ItemSummary[] }>) {
  return () => (
    <ul class="cards">
      {handle.props.items.map((item) => (
        <li key={item.id} class="card">
          <a href={routes.items.show.href({ itemId: item.id })}>
            <strong>{item.name}</strong>
          </a>
          {item.quantity > 1 ? ` × ${item.quantity}` : null}
          <br />
          <span class="status">
            {item.categoryName} · {item.city} · {item.ownerName}
          </span>
        </li>
      ))}
    </ul>
  )
}

/** Props of the add-item page. */
export interface AddItemPageProps {
  viewer: Viewer
  csrfToken: string
  values: ItemFormValues & { owner: string; locationId: string; ownerEmail: string }
  errors?: FieldErrors
  categories: SelectOption[]
  locations: SelectOption[]
  owners: SelectOption[]
}

/** Form to add an item (US-0.5.1). */
export function AddItemPage(handle: Handle<AddItemPageProps>) {
  return () => {
    const { viewer, csrfToken, values, errors = {}, categories, locations, owners } = handle.props
    return (
      <Layout title="Ajouter du matériel" viewer={viewer} section="mine">
        <h1>Ajouter du matériel</h1>
        <ErrorSummary errors={errors} />
        <form method="post" action={routes.items.create.action.href()} class="stack">
          <CsrfField token={csrfToken} />
          <SelectField
            name="locationId"
            label="Rangé dans"
            options={locations}
            value={values.locationId}
            error={errors.locationId}
            required
          />
          <SelectField
            name="owner"
            label="Appartient à"
            options={owners}
            value={values.owner}
            error={errors.owner}
            required
          />
          <TextField
            name="ownerEmail"
            label="E-mail de la personne propriétaire"
            type="email"
            value={values.ownerEmail}
            error={errors.ownerEmail}
            maxLength={254}
            hint="Seulement si « Une autre personne » : son compte doit être validé. Le matériel doit être rangé dans un lieu de votre collectif ; la personne pourra ensuite le modifier."
          />
          <ItemFields values={values} errors={errors} categories={categories} />
          <button type="submit">Ajouter</button>
        </form>
      </Layout>
    )
  }
}
