import type { Handle } from 'remix/component'

import type { Collectif } from '../../data/tables.ts'
import { routes } from '../../routes.ts'
import { CsrfField } from '../../ui/form.tsx'
import { Layout, type Viewer } from '../../ui/layout.tsx'

/** The viewer's relation to the collectif, which decides the call to action. */
export type Membership = 'responsible' | 'pending' | 'none'

/** Props of a collectif's page. */
export interface CollectifPageProps {
  viewer: Viewer
  csrfToken: string
  collectif: Collectif
  responsibleNames: string[]
  membership: Membership
  canEdit: boolean
  notice?: string
}

/** Public profile of an active collectif. */
export function CollectifPage(handle: Handle<CollectifPageProps>) {
  return () => {
    const { viewer, csrfToken, collectif, responsibleNames, membership, canEdit, notice } =
      handle.props
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
          <dd>{responsibleNames.length > 0 ? responsibleNames.join(', ') : 'aucun'}</dd>
        </dl>
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
      </Layout>
    )
  }
}
