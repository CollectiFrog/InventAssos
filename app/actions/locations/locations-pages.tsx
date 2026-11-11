import type { Handle } from 'remix/component'

import type { LocationWithOwner } from '../../data/locations.ts'
import { routes } from '../../routes.ts'
import type { FieldErrors } from '../../ui/form.tsx'
import { CsrfField } from '../../ui/form.tsx'
import { Layout, type Viewer } from '../../ui/layout.tsx'
import { LocationForm, type LocationFormValues, type OwnerOption } from './location-form.tsx'

/** Props of "Mes lieux". */
export interface LocationsPageProps {
  viewer: Viewer
  csrfToken: string
  locations: LocationWithOwner[]
  canCreate: boolean
  notice?: string
}

/** The locations the viewer manages. */
export function LocationsPage(handle: Handle<LocationsPageProps>) {
  return () => {
    const { viewer, csrfToken, locations, canCreate, notice } = handle.props
    return (
      <Layout title="Mes lieux" viewer={viewer} section="mine">
        <h1>Mes lieux de stockage</h1>
        {notice ? (
          <p class="notice notice-success" role="status">
            {notice}
          </p>
        ) : null}
        {canCreate ? (
          <p>
            <a class="button" href={routes.locations.create.index.href()}>
              Ajouter un lieu
            </a>
          </p>
        ) : (
          <p class="status">Vous pourrez ajouter des lieux une fois responsable d’un collectif.</p>
        )}
        {locations.length === 0 ? (
          <p>Aucun lieu pour l’instant.</p>
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
