import type { Handle } from 'remix/component'

import type { ItemSummary } from '../../data/items.ts'
import type { Collectif, Location } from '../../data/tables.ts'
import { routes } from '../../routes.ts'
import { CsrfField } from '../../ui/form.tsx'
import { Layout, type Viewer } from '../../ui/layout.tsx'
import { ItemList } from '../items/items-pages.tsx'

/** The viewer's relation to the collectif, which decides the call to action. */
export type Membership = 'responsible' | 'pending' | 'none'

/** Props of a collectif's page. */
export interface CollectifPageProps {
  viewer: Viewer
  csrfToken: string
  collectif: Collectif
  responsibles: { id: string; name: string }[]
  /** Platform admins see a remove form per responsible (US-0.3.6). */
  canManageResponsibles: boolean
  membership: Membership
  canEdit: boolean
  locations: Location[]
  canManageLocations: boolean
  items: ItemSummary[]
  notice?: string
}

/** Public profile of an active collectif. */
export function CollectifPage(handle: Handle<CollectifPageProps>) {
  return () => {
    const {
      viewer,
      csrfToken,
      collectif,
      responsibles,
      canManageResponsibles,
      membership,
      canEdit,
      locations,
      canManageLocations,
      items,
      notice,
    } = handle.props
    const slug = collectif.slug
    return (
      <Layout title={collectif.name} viewer={viewer}>
        <h1>{collectif.name}</h1>
        {notice ? (
          <p class="notice notice-success" role="status">
            {notice}
          </p>
        ) : null}
        {canEdit ? (
          <p>
            <a class="button secondary" href={routes.collectifs.edit.index.href({ slug })}>
              Modifier la présentation
            </a>
          </p>
        ) : null}
        {collectif.description ? <p class="prose">{collectif.description}</p> : null}
        <dl class="facts">
          <dt>Téléphone de contact</dt>
          <dd>{collectif.contact_phone ?? 'non renseigné'}</dd>
          <dt>Responsables</dt>
          <dd>{responsibles.length > 0 ? responsibles.map((r) => r.name).join(', ') : 'aucun'}</dd>
        </dl>
        <h2>Matériel</h2>
        {items.length === 0 ? <p>Aucun matériel déclaré.</p> : <ItemList items={items} />}
        <h2>Lieux de stockage</h2>
        {locations.length === 0 ? (
          <p>Aucun lieu déclaré.</p>
        ) : (
          <ul>
            {locations.map((location) => (
              <li key={location.id}>
                <a href={routes.locations.show.href({ locationId: location.id })}>
                  {location.name}
                </a>{' '}
                · {location.city}
                {location.address ? ` · ${location.address}` : null}
                {canManageLocations ? (
                  <>
                    {' '}
                    <a href={routes.locations.edit.index.href({ locationId: location.id })}>
                      modifier
                    </a>
                  </>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {canManageLocations ? (
          <p>
            <a
              class="button secondary"
              href={`${routes.locations.create.index.href()}?pour=collectif:${collectif.id}`}
            >
              Ajouter un lieu
            </a>
          </p>
        ) : null}
        {membership === 'responsible' ? (
          <p class="status">Vous êtes responsable de ce collectif.</p>
        ) : membership === 'pending' ? (
          <p class="status">Votre demande pour devenir responsable est en cours d’examen.</p>
        ) : (
          <form
            method="post"
            action={routes.collectifs.requestResponsibility.href({ slug })}
            class="stack"
          >
            <CsrfField token={csrfToken} />
            <p>Vous faites partie de ce collectif et voulez gérer son matériel ?</p>
            <button type="submit" class="secondary">
              Devenir responsable
            </button>
          </form>
        )}
        {canManageResponsibles && responsibles.length > 0 ? (
          <section>
            <h2>Gérer les responsables</h2>
            <p class="status">
              Un collectif actif garde toujours au moins un responsable : pour retirer le dernier,
              indiquez l’e-mail d’un utilisateur validé qui le remplace.
            </p>
            <ul class="cards">
              {responsibles.map((r) => (
                <li key={r.id} class="card">
                  <form
                    method="post"
                    action={routes.admin.responsibles.remove.href({
                      collectifId: collectif.id,
                      userId: r.id,
                    })}
                    class="inline-form"
                  >
                    <CsrfField token={csrfToken} />
                    <strong>{r.name}</strong>
                    <label for={`replacement-${r.id}`}>Remplacé par (e-mail, facultatif)</label>
                    <input
                      id={`replacement-${r.id}`}
                      name="replacementEmail"
                      type="email"
                      maxLength={254}
                    />
                    <button type="submit" class="danger">
                      Retirer
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </Layout>
    )
  }
}
