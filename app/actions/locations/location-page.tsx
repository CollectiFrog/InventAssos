import type { Handle } from 'remix/component'

import type { Location } from '../../data/tables.ts'
import { routes } from '../../routes.ts'
import { Layout, type Viewer } from '../../ui/layout.tsx'

/** Props of a location's page. Address and notes are already redacted for this viewer. */
export interface LocationPageProps {
  viewer: Viewer
  location: Location & { ownerName: string; ownerSlug: string | null }
  canManage: boolean
}

/** A storage location: the city for everybody, the address for its managers and admins. */
export function LocationPage(handle: Handle<LocationPageProps>) {
  return () => {
    const { viewer, location, canManage } = handle.props
    return (
      <Layout title={location.name} viewer={viewer}>
        <h1>{location.name}</h1>
        <dl class="facts">
          <dt>Ville</dt>
          <dd>{location.city}</dd>
          <dt>Appartient à</dt>
          <dd>
            {location.ownerSlug ? (
              <a href={routes.collectifs.show.href({ slug: location.ownerSlug })}>
                {location.ownerName}
              </a>
            ) : (
              location.ownerName
            )}
          </dd>
          {location.address ? (
            <>
              <dt>Adresse</dt>
              <dd>{location.address}</dd>
            </>
          ) : null}
          {location.notes ? (
            <>
              <dt>Notes</dt>
              <dd class="prose">{location.notes}</dd>
            </>
          ) : null}
        </dl>
        {canManage ? (
          <p>
            <a
              class="button secondary"
              href={routes.locations.edit.index.href({ locationId: location.id })}
            >
              Modifier
            </a>
          </p>
        ) : null}
      </Layout>
    )
  }
}
