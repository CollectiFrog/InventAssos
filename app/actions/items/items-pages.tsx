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
import { Tabs } from '../../ui/tabs.tsx'
import { ItemFields } from './item-fields.tsx'
import { type ItemFormValues, newLocationChoice } from './schema.ts'

/** The two tabs of Mon matériel: what I hold, and my own locations (US-0.7.3). */
export function MyStuffTabs(handle: Handle<{ current: 'items' | 'locations' }>) {
  return () => (
    <Tabs
      label="Mon matériel"
      tabs={[
        {
          label: 'Matériel',
          href: routes.items.index.href(),
          current: handle.props.current === 'items',
        },
        {
          label: 'Lieux',
          href: routes.locations.index.href(),
          current: handle.props.current === 'locations',
        },
      ]}
    />
  )
}

/** Props of Mon matériel: items stored at my places, by owner. */
export interface MyItemsPageProps {
  viewer: Viewer
  mine: ItemSummary[]
  collectifs: ItemSummary[]
  borrowed: ItemSummary[]
  notice?: string
}

/** "Mon matériel": what is stored in my own locations right now, by owner (US-0.7.3). */
export function MyItemsPage(handle: Handle<MyItemsPageProps>) {
  return () => {
    const { viewer, mine, collectifs, borrowed, notice } = handle.props
    const sections = [
      { id: 'a-moi', title: 'À moi', items: mine },
      { id: 'a-mes-collectifs', title: 'À mes collectifs', items: collectifs },
      { id: 'prete', title: 'Prêté par d’autres', items: borrowed },
    ].filter((section) => section.items.length > 0)
    return (
      <Layout title="Mon matériel" viewer={viewer} section="mine">
        <div class="page-head">
          <div>
            <h1>Mon matériel</h1>
            <p class="status">Ce qui est rangé chez vous en ce moment, et à qui il appartient.</p>
          </div>
          <a class="button" href={routes.items.create.index.href()}>
            Ajouter du matériel
          </a>
        </div>
        <MyStuffTabs current="items" />
        {notice ? (
          <p class="notice notice-success" role="status">
            {notice}
          </p>
        ) : null}
        {sections.length === 0 ? (
          <div class="card empty-state">
            <p>
              Rien n’est rangé chez vous pour l’instant. Ajoutez du matériel : vous pourrez créer le
              lieu où il est rangé dans le même formulaire.
            </p>
            <a class="button" href={routes.items.create.index.href()}>
              Ajouter du matériel
            </a>
          </div>
        ) : (
          sections.map((section) => (
            <section aria-labelledby={section.id}>
              <h2 id={section.id}>
                {section.title} · {section.items.length}
              </h2>
              <ItemList items={section.items} />
            </section>
          ))
        )}
        <p class="status">
          Le matériel rangé au local d’un collectif est sur la page du collectif.
        </p>
      </Layout>
    )
  }
}

/** A list of item summaries linking to their pages. */
export function ItemList(handle: Handle<{ items: ItemSummary[]; grid?: boolean }>) {
  return () => (
    <ul class={handle.props.grid ? 'cards item-grid' : 'cards'}>
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
  values: ItemFormValues & {
    owner: string
    locationId: string
    ownerEmail: string
    newLocationOwner: string
    newLocationName: string
    newLocationCity: string
  }
  errors?: FieldErrors
  categories: SelectOption[]
  /** Existing locations, then « Un nouveau lieu ». */
  locations: SelectOption[]
  /** Who a new location may belong to: me, or a collectif I manage. */
  locationOwners: SelectOption[]
  owners: SelectOption[]
}

/** Form to add an item (US-0.5.1). */
export function AddItemPage(handle: Handle<AddItemPageProps>) {
  return () => {
    const {
      viewer,
      csrfToken,
      values,
      errors = {},
      categories,
      locations,
      locationOwners,
      owners,
    } = handle.props
    const describesNewLocation =
      values.locationId === newLocationChoice ||
      Boolean(errors.newLocationName || errors.newLocationCity)
    return (
      <Layout title="Ajouter du matériel" viewer={viewer} section="mine">
        <h1>Ajouter du matériel</h1>
        <ErrorSummary errors={errors} />
        <form method="post" action={routes.items.create.action.href()} class="stack">
          <CsrfField token={csrfToken} />
          <ItemFields values={values} errors={errors} categories={categories} />
          {/* US-0.7.7: where it goes and whose it is, last, right above the button. */}
          <fieldset class="recap">
            <legend>Vérifiez avant d’ajouter</legend>
            <SelectField
              name="locationId"
              label="Rangé dans"
              options={locations}
              value={values.locationId}
              error={errors.locationId}
              required
            />
            <details class="new-location" open={describesNewLocation}>
              <summary>Créer un nouveau lieu</summary>
              <p class="hint">
                Choisissez « Un nouveau lieu » ci-dessus, puis décrivez-le. L’adresse et les notes
                se complètent ensuite depuis la page du lieu.
              </p>
              <SelectField
                name="newLocationOwner"
                label="Lieu de"
                options={locationOwners}
                value={values.newLocationOwner}
                error={errors.newLocationOwner}
                required
              />
              <TextField
                name="newLocationName"
                label="Nom du lieu"
                value={values.newLocationName}
                error={errors.newLocationName}
                requiredIfUsed
                maxLength={120}
                hint="Garage, cave, local de répétition…"
              />
              <TextField
                name="newLocationCity"
                label="Ville"
                value={values.newLocationCity}
                error={errors.newLocationCity}
                requiredIfUsed
                maxLength={120}
                autoComplete="address-level2"
                hint="La seule information du lieu visible par les autres."
              />
            </details>
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
          </fieldset>
          <button type="submit">Ajouter</button>
        </form>
      </Layout>
    )
  }
}
