import type { Handle } from 'remix/component'

import type { Location } from '../../data/tables.ts'
import { routes } from '../../routes.ts'
import { Layout, type Viewer } from '../../ui/layout.tsx'

/** Props of a location's page. Address and notes are already redacted for this viewer. */
export interface LocationPageProps {
  viewer: Viewer
  location: Location & { ownerName: string; ownerSlug: string | null }
  canManage: boolean
  /** « Retour » on phones (`backHref`). */
  back: string
}

/** A storage location: the city for everybody, the address for its managers and admins. */
export function LocationPage(handle: Handle<LocationPageProps>) {
  return () => {
    const { viewer, location, canManage, back } = handle.props
    // A collectif's place sits under its Lieux tab; a personal one under Mon matériel › Lieux.
    const trail = location.ownerSlug
      ? [
          { label: 'Collectifs', href: routes.collectifs.index.href() },
          {
            label: location.ownerName,
            href: routes.collectifs.places.href({ slug: location.ownerSlug }),
          },
          { label: location.name },
        ]
      : [
          { label: 'Mon matériel', href: routes.items.index.href() },
          { label: 'Lieux', href: routes.locations.index.href() },
          { label: location.name },
        ]
    return (
      <Layout
        title={location.name}
        viewer={viewer}
        section={location.ownerSlug ? 'collectifs' : 'mine'}
        trail={trail}
        back={back}
      >
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
