import type { Handle } from 'remix/component'

import type { ItemSummary } from '../data/items.ts'
import { routes } from '../routes.ts'
import { Layout, type Viewer } from '../ui/layout.tsx'
import { ItemList } from './items/items-pages.tsx'

/** What a validated user's home page shows (US-0.7.2). */
export interface Dashboard {
  collectifs: { id: string; name: string; slug: string; city: string; itemCount: number }[]
  recent: ItemSummary[]
  /** Requests waiting in the queue, for those who review them; undefined for everyone else. */
  pending?: { accounts: number; collectifs: number; responsibles: number }
}

/** "1 compte", "2 comptes": French plural of a count. */
function plural(n: number, one: string, many: string): string {
  return `${n} ${n > 1 ? many : one}`
}

/** Home page: the dashboard for validated users, a presentation for everyone else. */
export function HomePage(
  handle: Handle<{ databaseOk: boolean; viewer: Viewer; dashboard?: Dashboard }>,
) {
  return () => {
    const { databaseOk, viewer, dashboard } = handle.props
    if (viewer && dashboard) {
      return (
        <Layout title="Accueil" viewer={viewer} section="home">
          <h1>Bonjour {viewer.name}</h1>
          <DashboardView dashboard={dashboard} />
        </Layout>
      )
    }
    return (
      <Layout title="Accueil" viewer={viewer} section="home">
        <h1>InventAssos</h1>
        <p>
          Inventaire de matériel partagé entre associations : chaque collectif référence son
          matériel, ses membres le trouvent et contactent qui le garde.
        </p>
        {viewer ? null : (
          <p class="actions">
            <a class="button" href={routes.signIn.form.index.href()}>
              Se connecter
            </a>
            <a class="button secondary" href={routes.signUp.form.index.href()}>
              Créer un compte
            </a>
          </p>
        )}
        <p class="status">Base de données : {databaseOk ? 'connectée' : 'injoignable'}</p>
      </Layout>
    )
  }
}

/** Search first, then pending requests, recent equipment and my collectifs. */
function DashboardView(handle: Handle<{ dashboard: Dashboard }>) {
  return () => {
    const { collectifs, recent, pending } = handle.props.dashboard
    const waiting = pending ? pending.accounts + pending.collectifs + pending.responsibles : 0
    return (
      <>
        <form method="get" action={routes.inventory.index.href()} class="home-search">
          <label for="recherche-accueil">Chercher dans mes collectifs</label>
          <div class="inline-form">
            <input
              type="search"
              id="recherche-accueil"
              name="q"
              placeholder="Perceuse, enceinte, barnum…"
              maxLength={100}
            />
            <button type="submit">Rechercher</button>
          </div>
        </form>
        {pending && waiting > 0 ? (
          <a class="card pending-card" href={routes.admin.index.href()}>
            <span class="pending-count">{waiting}</span>
            <span>
              <strong>{waiting > 1 ? 'Demandes à valider' : 'Demande à valider'}</strong>
              <br />
              <span class="status">
                {[
                  pending.accounts ? plural(pending.accounts, 'compte', 'comptes') : '',
                  pending.collectifs ? plural(pending.collectifs, 'collectif', 'collectifs') : '',
                  pending.responsibles
                    ? plural(pending.responsibles, 'responsable', 'responsables')
                    : '',
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            </span>
          </a>
        ) : null}
        <div class="dashboard">
          <section aria-labelledby="recent-titre">
            <h2 id="recent-titre">Ajouté récemment</h2>
            {recent.length > 0 ? (
              <ItemList items={recent} />
            ) : (
              <div class="card empty-state">
                <p>Aucun matériel pour l’instant dans vos collectifs ni dans vos lieux.</p>
                <a class="button" href={routes.items.create.index.href()}>
                  Ajouter du matériel
                </a>
              </div>
            )}
          </section>
          <section aria-labelledby="accueil-collectifs">
            <h2 id="accueil-collectifs">Mes collectifs</h2>
            {collectifs.length > 0 ? (
              <ul class="cards">
                {collectifs.map((c) => (
                  <li key={c.id} class="card">
                    <a href={routes.collectifs.show.href({ slug: c.slug })}>
                      <strong>{c.name}</strong>
                    </a>
                    <br />
                    <span class="status">
                      {[c.city, plural(c.itemCount, 'objet', 'objets')].filter(Boolean).join(' · ')}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <div class="card empty-state">
                <p>
                  Vous ne faites encore partie d’aucun collectif. Trouvez le vôtre dans l’annuaire,
                  ou déclarez-le s’il n’y est pas.
                </p>
                <p class="actions">
                  <a class="button" href={routes.collectifs.index.href()}>
                    Voir les collectifs
                  </a>
                  <a class="button secondary" href={routes.collectifs.request.index.href()}>
                    Déclarer un collectif
                  </a>
                </p>
              </div>
            )}
          </section>
        </div>
      </>
    )
  }
}
