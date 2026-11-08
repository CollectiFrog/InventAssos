import type { Handle } from 'remix/component'

import type { Collectif } from '../../../data/tables.ts'
import { routes } from '../../../routes.ts'
import {
  CsrfField,
  ErrorSummary,
  type FieldErrors,
  TextArea,
  TextField,
} from '../../../ui/form.tsx'
import { Layout, type Viewer } from '../../../ui/layout.tsx'

/** Props of the collectif edit form. */
export interface EditCollectifPageProps {
  viewer: Viewer
  csrfToken: string
  collectif: Collectif
  values: { description: string; contactPhone: string }
  errors?: FieldErrors
}

/** Description and contact phone of a collectif (US-0.3.5). */
export function EditCollectifPage(handle: Handle<EditCollectifPageProps>) {
  return () => {
    const { viewer, csrfToken, collectif, values, errors = {} } = handle.props
    const slug = collectif.slug
    return (
      <Layout title={`Modifier ${collectif.name}`} viewer={viewer}>
        <h1>Modifier « {collectif.name} »</h1>
        <p class="status">
          Pour changer le nom du collectif, contactez un administrateur de la plateforme.
        </p>
        <ErrorSummary errors={errors} />
        <form method="post" action={routes.collectifs.edit.action.href({ slug })} class="stack">
          <CsrfField token={csrfToken} />
          <TextArea
            name="description"
            label="Description"
            value={values.description}
            error={errors.description}
            maxLength={2000}
          />
          <TextField
            name="contactPhone"
            label="Téléphone de contact"
            type="tel"
            value={values.contactPhone}
            error={errors.contactPhone}
            maxLength={25}
            hint="Visible par les utilisateurs validés."
          />
          <div class="actions">
            <button type="submit">Enregistrer</button>
            <a class="button secondary" href={routes.collectifs.show.href({ slug })}>
              Annuler
            </a>
          </div>
        </form>
      </Layout>
    )
  }
}
