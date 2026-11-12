import type { Handle } from 'remix/component'

import type { Collectif } from '../../data/tables.ts'
import { routes } from '../../routes.ts'
import { CsrfField, ErrorSummary, type FieldErrors, TextArea, TextField } from '../../ui/form.tsx'
import { Layout, type Viewer } from '../../ui/layout.tsx'

/** Props of the collectifs directory. */
export interface CollectifsPageProps {
  viewer: Viewer
  /** Collectifs the viewer belongs to, always all of them. */
  mine: Collectif[]
  /** The other active collectifs matching `query`. */
  others: Collectif[]
  query: string
  myRequests: Collectif[]
  notice?: string
}

/** One collectif of the directory: name, city and description, never what it holds (ADR 0021). */
function DirectoryCard(handle: Handle<{ collectif: Collectif; mine?: boolean }>) {
  return () => {
    const { collectif, mine } = handle.props
    return (
      <li class="card directory-card">
        <p class="directory-name">
          <a href={routes.collectifs.show.href({ slug: collectif.slug })}>
            <strong>{collectif.name}</strong>
          </a>
          {mine ? <span class="badge">Responsable</span> : null}
        </p>
        {collectif.city ? <p class="status">{collectif.city}</p> : null}
        {collectif.description ? <p class="excerpt">{collectif.description}</p> : null}
      </li>
    )
  }
}

/** My collectifs first, then the directory of the others with a search (US-0.7.12). */
export function CollectifsPage(handle: Handle<CollectifsPageProps>) {
  return () => {
    const { viewer, mine, others, query, myRequests, notice } = handle.props
    const requestHref = routes.collectifs.request.index.href()
    return (
      <Layout title="Collectifs" viewer={viewer} section="collectifs">
        <div class="page-head">
          <div>
            <h1>Collectifs</h1>
            <p class="status">Vos collectifs, puis l’annuaire de tous les collectifs.</p>
          </div>
          <a class="button secondary" href={requestHref}>
            Déclarer un collectif
          </a>
        </div>
        {notice ? (
          <p class="notice notice-success" role="status">
            {notice}
          </p>
        ) : null}
        {myRequests.length > 0 ? (
          <section aria-labelledby="mes-demandes">
            <h2 id="mes-demandes">Mes demandes en cours</h2>
            <ul>
              {myRequests.map((c) => (
                <li key={c.id}>
                  {c.name} <span class="status">— en attente de validation</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        {mine.length > 0 ? (
          <section aria-labelledby="mes-collectifs-titre">
            <h2 id="mes-collectifs-titre">Mes collectifs</h2>
            <ul class="cards directory">
              {mine.map((c) => (
                <DirectoryCard key={c.id} collectif={c} mine />
              ))}
            </ul>
          </section>
        ) : null}
        <section aria-labelledby="autres-collectifs">
          <h2 id="autres-collectifs">
            {mine.length > 0 ? 'Autres collectifs' : 'Tous les collectifs'} · {others.length}
          </h2>
          <form
            method="get"
            action={routes.collectifs.index.href()}
            class="inline-form directory-search"
          >
            <label for="chercher-collectif" class="visually-hidden">
              Chercher un collectif par nom ou ville
            </label>
            <input
              type="search"
              id="chercher-collectif"
              name="q"
              value={query}
              placeholder="Nom ou ville"
              maxLength={100}
            />
            <button type="submit" class="secondary">
              Chercher
            </button>
            {query ? <a href={routes.collectifs.index.href()}>Tout afficher</a> : null}
          </form>
          <ul class="cards directory">
            {others.map((c) => (
              <DirectoryCard key={c.id} collectif={c} />
            ))}
            <li class="card directory-card directory-new">
              <p>
                <strong>Votre association n’y est pas ?</strong>
              </p>
              <p class="status">Déclarez-la : vous en deviendrez responsable.</p>
              <a class="button secondary" href={requestHref}>
                Déclarer un collectif
              </a>
            </li>
          </ul>
          {others.length === 0 && query ? (
            <p role="status">Aucun collectif ne correspond à « {query} ».</p>
          ) : null}
        </section>
      </Layout>
    )
  }
}

/** Values and errors of the request form. */
export interface RequestCollectifPageProps {
  viewer: Viewer
  csrfToken: string
  values?: { name: string; city: string; description: string; contactPhone: string }
  errors?: FieldErrors
}

/** Form to request a new collectif (US-0.3.1). */
export function RequestCollectifPage(handle: Handle<RequestCollectifPageProps>) {
  return () => {
    const { viewer, csrfToken, values, errors = {} } = handle.props
    return (
      <Layout title="Déclarer un collectif" viewer={viewer} section="collectifs">
        <h1>Déclarer un collectif</h1>
        <p>
          Un administrateur ou un modérateur vérifie chaque demande. Une fois le collectif validé,
          vous en devenez responsable.
        </p>
        <ErrorSummary errors={errors} />
        <form method="post" action={routes.collectifs.request.action.href()} class="stack">
          <CsrfField token={csrfToken} />
          <TextField
            name="name"
            label="Nom du collectif"
            value={values?.name}
            error={errors.name}
            required
            maxLength={120}
          />
          <TextField
            name="city"
            label="Ville"
            value={values?.city}
            error={errors.city}
            required
            maxLength={120}
            autoComplete="address-level2"
            hint="Montrée dans l’annuaire des collectifs, pour qu’on vous trouve."
          />
          <TextArea
            name="description"
            label="Description"
            value={values?.description}
            error={errors.description}
            maxLength={2000}
            hint="Activité, type de matériel… visible par tous les utilisateurs validés."
          />
          <TextField
            name="contactPhone"
            label="Téléphone de contact"
            type="tel"
            value={values?.contactPhone}
            error={errors.contactPhone}
            maxLength={25}
            hint="Visible par les personnes qui voient le matériel du collectif."
          />
          <button type="submit">Envoyer la demande</button>
        </form>
      </Layout>
    )
  }
}
