import type { Handle } from 'remix/component'

import type { Collectif } from '../../data/tables.ts'
import { routes } from '../../routes.ts'
import { CsrfField, ErrorSummary, type FieldErrors, TextArea, TextField } from '../../ui/form.tsx'
import { Layout, type Viewer } from '../../ui/layout.tsx'

/** Props of the collectif list. */
export interface CollectifsPageProps {
  viewer: Viewer
  active: Collectif[]
  myRequests: Collectif[]
  notice?: string
}

/** Active collectifs, and the viewer's own pending requests. */
export function CollectifsPage(handle: Handle<CollectifsPageProps>) {
  return () => {
    const { viewer, active, myRequests, notice } = handle.props
    return (
      <Layout title="Collectifs" viewer={viewer}>
        <h1>Collectifs</h1>
        {notice ? (
          <p class="notice notice-success" role="status">
            {notice}
          </p>
        ) : null}
        <p>
          <a class="button" href={routes.collectifs.request.index.href()}>
            Déclarer un collectif
          </a>
        </p>
        {myRequests.length > 0 ? (
          <>
            <h2>Mes demandes en cours</h2>
            <ul>
              {myRequests.map((c) => (
                <li key={c.id}>
                  {c.name} <span class="status">— en attente de validation</span>
                </li>
              ))}
            </ul>
          </>
        ) : null}
        <h2>Collectifs inscrits</h2>
        {active.length === 0 ? (
          <p>Aucun collectif pour l’instant.</p>
        ) : (
          <ul class="cards">
            {active.map((c) => (
              <li key={c.id} class="card">
                <a href={routes.collectifs.show.href({ slug: c.slug })}>
                  <strong>{c.name}</strong>
                </a>
                {c.description ? <p>{c.description}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </Layout>
    )
  }
}

/** Values and errors of the request form. */
export interface RequestCollectifPageProps {
  viewer: Viewer
  csrfToken: string
  values?: { name: string; description: string; contactPhone: string }
  errors?: FieldErrors
}

/** Form to request a new collectif (US-0.3.1). */
export function RequestCollectifPage(handle: Handle<RequestCollectifPageProps>) {
  return () => {
    const { viewer, csrfToken, values, errors = {} } = handle.props
    return (
      <Layout title="Déclarer un collectif" viewer={viewer}>
        <h1>Déclarer un collectif</h1>
        <p>
          Un administrateur de la plateforme vérifie chaque demande. Une fois le collectif validé,
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
          <TextArea
            name="description"
            label="Description"
            value={values?.description}
            error={errors.description}
            maxLength={2000}
            hint="Activité, lieu, type de matériel… visible par les utilisateurs validés."
          />
          <TextField
            name="contactPhone"
            label="Téléphone de contact"
            type="tel"
            value={values?.contactPhone}
            error={errors.contactPhone}
            maxLength={25}
            hint="Visible par les utilisateurs validés."
          />
          <button type="submit">Envoyer la demande</button>
        </form>
      </Layout>
    )
  }
}
