import type { Handle } from 'remix/component'

import type { ItemSort, ItemSummary } from '../../data/items.ts'
import type { CollectifPerson, MembershipRequest } from '../../data/members.ts'
import type { Collectif, Location } from '../../data/tables.ts'
import { routes } from '../../routes.ts'
import { CsrfField } from '../../ui/form.tsx'
import { ItemTable, type ItemView, ViewSwitch } from '../../ui/item-table.tsx'
import { Layout, type Viewer } from '../../ui/layout.tsx'
import { Tabs } from '../../ui/tabs.tsx'
import { ItemList } from '../items/items-pages.tsx'

/** The viewer's relation to the collectif, which decides the call to action. */
export type Membership = 'responsible' | 'member' | 'pendingMember' | 'pendingResponsible' | 'none'

const dateFormat = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
  timeZone: 'Europe/Paris',
})

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
  /** Its responsibles and members, and admins: « Ajouter du matériel » comes first. */
  canAddItems: boolean
  canManageLocations: boolean
  /** Platform admins see a remove form per responsible (US-0.3.6). */
  canManageResponsibles: boolean
  /** Its responsibles accept, reject and remove members (US-0.8.4). */
  canManageMembers: boolean
  /** Its responsibles, admins and moderators name and remove responsibles (US-0.8.6). */
  canNameResponsibles: boolean
  /** The viewer, to offer « Quitter le collectif » on their own row (US-0.8.8). */
  viewerId: string
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
  /** Its responsibles and members (Membres tab only). */
  people: CollectifPerson[]
  /** Pending requests to join, for its responsibles (Membres tab only). */
  requests: MembershipRequest[]
  /** « Retour » on phones (`backHref`). */
  back: string
  notice?: string
}

/** A collectif's page: header, then tabs Matériel, Lieux, Membres for its people. */
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
      <Layout
        title={collectif.name}
        viewer={p.viewer}
        section="collectifs"
        back={p.back}
        trail={[
          { label: 'Collectifs', href: routes.collectifs.index.href() },
          { label: collectif.name },
        ]}
      >
        <div class="page-head">
          <div>
            <h1>{collectif.name}</h1>
            {facts.length > 0 ? (
              <p class="status">
                {facts.join(' · ')}
                {membership === 'responsible' ? (
                  <span class="badge">Vous êtes responsable</span>
                ) : membership === 'member' ? (
                  <span class="badge">Vous êtes membre</span>
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
                  label:
                    p.requests.length > 0 ? `Membres · ${p.requests.length} en attente` : 'Membres',
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
            Le matériel, les lieux et les membres de ce collectif ne sont visibles que par ses
            membres. Une fois votre demande acceptée par un responsable, vous verrez son inventaire.
          </p>
        )}
        {membership === 'pendingMember' ? (
          <p class="status">
            Votre demande pour rejoindre ce collectif est en cours : un responsable va l’examiner.
          </p>
        ) : membership === 'pendingResponsible' ? (
          <p class="status">Votre demande pour devenir responsable est en cours d’examen.</p>
        ) : membership === 'none' ? (
          <div class="stack">
            <form method="post" action={routes.collectifs.join.href({ slug })}>
              <CsrfField token={p.csrfToken} />
              <button type="submit">Demander à rejoindre</button>
            </form>
            <form
              method="post"
              action={routes.collectifs.requestResponsibility.href({ slug })}
              class="stack"
            >
              <CsrfField token={p.csrfToken} />
              <p class="status">
                Vous gérez ce collectif et il n’a plus de responsable joignable ? La plateforme peut
                vous en nommer responsable.
              </p>
              <button type="submit" class="secondary">
                Demander à devenir responsable
              </button>
            </form>
          </div>
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

/** "Responsable", "Membre". */
const roleLabels = { responsible: 'Responsable', member: 'Membre' } as const

/**
 * Membres: pending requests first for its responsibles (US-0.8.7), then everyone with their role,
 * its contact phone, and the admins' forms to remove a responsible.
 */
function PeopleTab(handle: Handle<CollectifPageProps>) {
  return () => {
    const {
      people,
      requests,
      canManageMembers,
      canNameResponsibles,
      canManageResponsibles,
      collectif,
      csrfToken,
      viewerId,
    } = handle.props
    const slug = collectif.slug
    const responsibles = people.filter((person) => person.role === 'responsible')
    // The last responsible keeps the role until another is named (US-0.8.6, US-0.8.8).
    const lastResponsible = responsibles.length === 1 ? responsibles[0]?.id : undefined
    const me = people.find((person) => person.id === viewerId)
    const hasActions = canManageMembers || canNameResponsibles
    return (
      <>
        {canManageMembers && requests.length > 0 ? (
          <section aria-labelledby="demandes">
            <h2 id="demandes">Demandes pour rejoindre · {requests.length}</h2>
            <ul class="cards">
              {requests.map((request) => (
                <li key={request.userId} class="card row">
                  <span>
                    <strong>{request.name}</strong>{' '}
                    <span class="status">
                      demande à rejoindre le collectif · {dateFormat.format(request.requestedAt)}
                    </span>
                  </span>
                  <span class="actions">
                    <form
                      method="post"
                      action={routes.collectifs.members.approve.href({
                        slug,
                        userId: request.userId,
                      })}
                    >
                      <CsrfField token={csrfToken} />
                      <button type="submit">Accepter</button>
                    </form>
                    <form
                      method="post"
                      action={routes.collectifs.members.reject.href({
                        slug,
                        userId: request.userId,
                      })}
                    >
                      <CsrfField token={csrfToken} />
                      <button type="submit" class="secondary">
                        Refuser
                      </button>
                    </form>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        <section aria-labelledby="membres">
          <h2 id="membres">Membres · {people.length}</h2>
          <table class="data-table">
            <caption class="visually-hidden">Membres de {collectif.name}</caption>
            <thead>
              <tr>
                <th scope="col">Nom</th>
                <th scope="col">Rôle</th>
                {hasActions ? (
                  <th scope="col">
                    <span class="visually-hidden">Actions</span>
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {people.map((person) => (
                <tr key={person.id}>
                  <td data-label="Nom">
                    <a href={routes.people.show.href({ userId: person.id })}>{person.name}</a>
                  </td>
                  <td data-label="Rôle">{roleLabels[person.role]}</td>
                  {hasActions ? (
                    <td data-label="Actions">
                      <span class="actions">
                        {canNameResponsibles && person.role === 'member' ? (
                          <form
                            method="post"
                            action={routes.collectifs.members.promote.href({
                              slug,
                              userId: person.id,
                            })}
                          >
                            <CsrfField token={csrfToken} />
                            <button type="submit" class="secondary">
                              Nommer {person.name} responsable
                            </button>
                          </form>
                        ) : null}
                        {canNameResponsibles &&
                        person.role === 'responsible' &&
                        person.id !== lastResponsible ? (
                          <form
                            method="post"
                            action={routes.collectifs.members.demote.href({
                              slug,
                              userId: person.id,
                            })}
                          >
                            <CsrfField token={csrfToken} />
                            <button type="submit" class="secondary">
                              Retirer le rôle de responsable à {person.name}
                            </button>
                          </form>
                        ) : null}
                        {canManageMembers && person.role === 'member' ? (
                          <form
                            method="post"
                            action={routes.collectifs.members.remove.href({
                              slug,
                              userId: person.id,
                            })}
                          >
                            <CsrfField token={csrfToken} />
                            <button type="submit" class="secondary">
                              Retirer {person.name}
                            </button>
                          </form>
                        ) : null}
                      </span>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
          <dl class="facts">
            <dt>Téléphone de contact</dt>
            <dd>{collectif.contact_phone ?? 'non renseigné'}</dd>
          </dl>
        </section>
        {me ? (
          <section aria-labelledby="quitter">
            <h2 id="quitter">Quitter le collectif</h2>
            {me.id === lastResponsible ? (
              <p class="status">
                Vous êtes le seul responsable : nommez d’abord un membre responsable pour pouvoir
                partir.
              </p>
            ) : (
              <form method="post" action={routes.collectifs.members.leave.href({ slug })}>
                <CsrfField token={csrfToken} />
                <p class="status">
                  Vous ne verrez plus son matériel, ses lieux ni ses membres. Votre propre matériel
                  reste à vous.
                </p>
                <button type="submit" class="danger">
                  Quitter « {collectif.name} »
                </button>
              </form>
            )}
          </section>
        ) : null}
        {canManageResponsibles && responsibles.length > 0 ? (
          <section aria-labelledby="gerer-responsables">
            <h2 id="gerer-responsables">Remplacer un responsable</h2>
            <p class="status">
              Pour la plateforme, quand le collectif n’a pas de membre à nommer : indiquez l’e-mail
              d’un utilisateur validé qui devient responsable. La personne retirée reste membre.
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
