import type { Handle } from 'remix/component'

import type { LocationWithOwner } from '../../data/locations.ts'
import { routes } from '../../routes.ts'
import type { FieldErrors } from '../../ui/form.tsx'
import { CsrfField } from '../../ui/form.tsx'
import { Layout, type Viewer } from '../../ui/layout.tsx'
import { MyStuffTabs } from '../items/items-pages.tsx'
import { LocationForm, type LocationFormValues, type OwnerOption } from './location-form.tsx'

/** Props of "Mes lieux". */
export interface LocationsPageProps {
  viewer: Viewer
  csrfToken: string
  locations: LocationWithOwner[]
  notice?: string
}

/** The Lieux tab of Mon matériel: the viewer's own locations (US-0.7.3). */
export function LocationsPage(handle: Handle<LocationsPageProps>) {
  return () => {
    const { viewer, csrfToken, locations, notice } = handle.props
    return (
      <Layout title="Mes lieux" viewer={viewer} section="mine">
        <div class="page-head">
          <div>
            <h1>Mon matériel</h1>
            <p class="status">Vos lieux de stockage : garage, cave, local personnel…</p>
          </div>
          <a class="button" href={`${routes.locations.create.index.href()}?pour=me`}>
            Ajouter un lieu
          </a>
        </div>
        <MyStuffTabs current="locations" />
        {notice ? (
          <p class="notice notice-success" role="status">
            {notice}
          </p>
        ) : null}
        {locations.length === 0 ? (
          <div class="card empty-state">
            <p>Aucun lieu pour l’instant. Déclarez où vous rangez du matériel.</p>
            <a class="button" href={`${routes.locations.create.index.href()}?pour=me`}>
              Ajouter un lieu
            </a>
          </div>
        ) : (
          <ul class="cards">
            {locations.map((location) => (
              <li key={location.id} class="card">
                <p>
                  <strong>{location.name}</strong> · {location.city}
                  <br />
                  <span class="status">{location.ownerName}</span>
                </p>
                {location.address ? <p>{location.address}</p> : null}
                {location.notes ? <p class="prose">{location.notes}</p> : null}
                <div class="actions">
                  <a
                    class="button secondary"
                    href={routes.locations.edit.index.href({ locationId: location.id })}
                  >
                    Modifier
                  </a>
                  <form
                    method="post"
                    action={routes.locations.remove.href({ locationId: location.id })}
                  >
                    <CsrfField token={csrfToken} />
                    <button type="submit" class="danger">
                      Supprimer
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Layout>
    )
  }
}

/** Props of the create and edit pages. */
export interface LocationEditorPageProps {
  viewer: Viewer
  csrfToken: string
  title: string
  action: string
  values: LocationFormValues
  errors?: FieldErrors
  ownerOptions?: OwnerOption[]
  submitLabel: string
}

/** Page wrapping the location form. */
export function LocationEditorPage(handle: Handle<LocationEditorPageProps>) {
  return () => {
    const { viewer, title, ...form } = handle.props
    return (
      <Layout title={title} viewer={viewer} section="mine">
        <h1>{title}</h1>
        <LocationForm {...form} />
        <p>
          <a href={routes.locations.index.href()}>Retour à mes lieux</a>
        </p>
      </Layout>
    )
  }
}
