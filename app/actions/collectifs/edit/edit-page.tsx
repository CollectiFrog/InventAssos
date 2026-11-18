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
  values: { name: string; city: string; description: string; contactPhone: string }
  errors?: FieldErrors
}

/** Name, city, description and contact phone of a collectif (US-0.3.5, US-0.10.14). */
export function EditCollectifPage(handle: Handle<EditCollectifPageProps>) {
  return () => {
    const { viewer, csrfToken, collectif, values, errors = {} } = handle.props
    const slug = collectif.slug
    return (
      <Layout title={`Modifier ${collectif.name}`} viewer={viewer} section="collectifs">
        <h1>Modifier « {collectif.name} »</h1>
        <ErrorSummary errors={errors} />
        <form method="post" action={routes.collectifs.edit.action.href({ slug })} class="stack">
          <CsrfField token={csrfToken} />
          <TextField
            name="name"
            label="Nom du collectif"
            value={values.name}
            error={errors.name}
            required
            autoComplete="off"
            maxLength={120}
            hint="Son adresse dans l’application suit le nom : les anciens liens ne mènent plus à lui."
          />
          <TextField
            name="city"
            label="Ville"
            value={values.city}
            error={errors.city}
            required
            maxLength={120}
            autoComplete="address-level2"
            hint="Montrée dans l’annuaire des collectifs."
          />
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
            hint="Visible par les personnes qui voient le matériel du collectif."
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
