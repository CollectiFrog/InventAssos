import type { Handle } from 'remix/component'

import type { ItemSort, ItemSummary } from '../../data/items.ts'
import type { Collectif, Location } from '../../data/tables.ts'
import { routes } from '../../routes.ts'
import { CsrfField } from '../../ui/form.tsx'
import { ItemTable, type ItemView, ViewSwitch } from '../../ui/item-table.tsx'
import { Layout, type Viewer } from '../../ui/layout.tsx'
import { Tabs } from '../../ui/tabs.tsx'
import { ItemList } from '../items/items-pages.tsx'

/** The viewer's relation to the collectif, which decides the call to action. */
export type Membership = 'responsible' | 'pending' | 'none'

/** The tabs of a collectif's page, each at its own URL (US-0.7.5). */
export type CollectifTab = 'items' | 'places' | 'people'

/** Props of a collectif's page. */
export interface CollectifPageProps {
  viewer: Viewer
  csrfToken: string
  collectif: Collectif
  tab: CollectifTab
  /** False for someone outside the collectif: name, city, description and request button only. */
  inside: boolean
  membership: Membership
  canEdit: boolean
  /** Responsibles and admins: « Ajouter du matériel » comes first. */
  canAddItems: boolean
  canManageLocations: boolean
  /** Platform admins see a remove form per responsible (US-0.3.6). */
  canManageResponsibles: boolean
  /** Items the collectif owns, sorted by `sort`, shown as `view`. */
  items: ItemSummary[]
  sort: ItemSort
  view: ItemView
  /** This tab's URL with some parameters changed. */
  hrefWith: (changes: Record<string, string>) => string
  /** Items stored in its locations that belong to someone else (Matériel tab only). */
  deposits: ItemSummary[]
  /** Its locations (Lieux tab only). */
  locations: Location[]
  /** Its responsibles (Responsables tab only). */
  responsibles: { id: string; name: string }[]
  notice?: string
}

/** A collectif's page: header, then tabs Matériel, Lieux, Responsables for its people. */
export function CollectifPage(handle: Handle<CollectifPageProps>) {
  return () => {
    const p = handle.props
    const { collectif, inside, membership } = p
    const slug = collectif.slug
    const facts = [
      collectif.city,
      inside ? `${p.items.length} ${p.items.length > 1 ? 'objets' : 'objet'}` : '',
    ].filter(Boolean)
    return (
      <Layout title={collectif.name} viewer={p.viewer} section="collectifs">
        <div class="page-head">
          <div>
            <h1>{collectif.name}</h1>
            {facts.length > 0 ? (
              <p class="status">
                {facts.join(' · ')}
                {membership === 'responsible' ? (
                  <span class="badge">Vous êtes responsable</span>
                ) : null}
              </p>
            ) : null}
          </div>
          {inside ? (
            <div class="actions">
              {p.canEdit ? (
                <a class="button secondary" href={routes.collectifs.edit.index.href({ slug })}>
                  Modifier la présentation
                </a>
              ) : null}
              {p.canAddItems ? (
                <a
                  class="button"
                  href={`${routes.items.create.index.href()}?pour=collectif:${collectif.id}`}
                >
                  Ajouter du matériel
                </a>
              ) : null}
            </div>
          ) : null}
        </div>
        {p.notice ? (
          <p class="notice notice-success" role="status">
            {p.notice}
          </p>
        ) : null}
        {collectif.description ? <p class="prose">{collectif.description}</p> : null}
        {inside ? (
          <>
            <Tabs
              label={collectif.name}
              tabs={[
                { label: 'Matériel', href: routes.collectifs.show.href({ slug }), tab: 'items' },
                { label: 'Lieux', href: routes.collectifs.places.href({ slug }), tab: 'places' },
                {
                  label: 'Responsables',
                  href: routes.collectifs.people.href({ slug }),
                  tab: 'people',
                },
              ].map(({ tab, ...link }) => ({ ...link, current: tab === p.tab }))}
            />
            {p.tab === 'items' ? <ItemsTab {...p} /> : null}
            {p.tab === 'places' ? <PlacesTab {...p} /> : null}
            {p.tab === 'people' ? <PeopleTab {...p} /> : null}
          </>
        ) : (
          <p class="status">
            Le matériel, les lieux et les personnes de ce collectif sont visibles par ses
            responsables uniquement.
          </p>
        )}
        {membership === 'pending' ? (
          <p class="status">Votre demande pour devenir responsable est en cours d’examen.</p>
        ) : membership === 'none' ? (
          <form
            method="post"
            action={routes.collectifs.requestResponsibility.href({ slug })}
            class="stack"
          >
            <CsrfField token={p.csrfToken} />
            <p>Vous faites partie de ce collectif et voulez gérer son matériel ?</p>
            <button type="submit" class="secondary">
              Demander à devenir responsable
            </button>
          </form>
        ) : null}
      </Layout>
    )
  }
}

/** Matériel: what the collectif owns, then what others deposited in its locations. */
function ItemsTab(handle: Handle<CollectifPageProps>) {
  return () => {
    const { items, deposits, canAddItems, collectif, sort, view, hrefWith } = handle.props
    return (
      <>
        <section aria-labelledby="materiel-collectif" class="index-results">
          <div class="results-bar">
            <h2 id="materiel-collectif">Matériel du collectif · {items.length}</h2>
            {items.length > 0 ? (
              <ViewSwitch
                view={view}
                hrefFor={(next) => hrefWith({ vue: next === 'grille' ? 'grille' : '' })}
              />
            ) : null}
          </div>
          {items.length > 0 && view === 'grille' ? (
            <ItemList items={items} grid />
          ) : items.length > 0 ? (
            <ItemTable
              items={items}
              caption={`Matériel de ${collectif.name}`}
              sort={sort}
              sortHref={(next) => hrefWith({ tri: `${next.descending ? '-' : ''}${next.column}` })}
            />
          ) : (
            <div class="card empty-state">
              <p>Aucun matériel déclaré pour l’instant.</p>
              {canAddItems ? (
                <a
                  class="button"
                  href={`${routes.items.create.index.href()}?pour=collectif:${collectif.id}`}
                >
                  Ajouter du matériel
                </a>
              ) : null}
            </div>
          )}
        </section>
        {deposits.length > 0 ? (
          <section aria-labelledby="depots">
            <h2 id="depots">Déposé dans nos lieux · {deposits.length}</h2>
            <p class="status">Du matériel rangé chez le collectif qui appartient à d’autres.</p>
            <ItemList items={deposits} />
          </section>
        ) : null}
      </>
    )
  }
}

/** Lieux: the collectif's locations; the address only for those who manage them. */
function PlacesTab(handle: Handle<CollectifPageProps>) {
  return () => {
    const { locations, canManageLocations, collectif } = handle.props
    return (
      <section aria-labelledby="lieux-collectif">
        <h2 id="lieux-collectif">Lieux de stockage · {locations.length}</h2>
        {locations.length === 0 ? (
          <p>Aucun lieu déclaré.</p>
        ) : (
          <ul class="cards">
            {locations.map((location) => (
              <li key={location.id} class="card">
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
      </section>
    )
  }
}

/** Responsables: who runs the collectif, its contact phone, and the admins' removal forms. */
function PeopleTab(handle: Handle<CollectifPageProps>) {
  return () => {
    const { responsibles, canManageResponsibles, collectif, csrfToken } = handle.props
    return (
      <>
        <section aria-labelledby="responsables">
          <h2 id="responsables">Responsables · {responsibles.length}</h2>
          {responsibles.length === 0 ? (
            <p>Aucun responsable.</p>
          ) : (
            <ul class="cards">
              {responsibles.map((r) => (
                <li key={r.id} class="card">
                  <a href={routes.people.show.href({ userId: r.id })}>{r.name}</a>
                </li>
              ))}
            </ul>
          )}
          <dl class="facts">
            <dt>Téléphone de contact</dt>
            <dd>{collectif.contact_phone ?? 'non renseigné'}</dd>
          </dl>
        </section>
        {canManageResponsibles && responsibles.length > 0 ? (
          <section aria-labelledby="gerer-responsables">
            <h2 id="gerer-responsables">Gérer les responsables</h2>
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
      </>
    )
  }
}
