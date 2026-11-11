import type { Handle } from 'remix/component'

import { CsrfField, ErrorSummary, type FieldErrors, TextArea, TextField } from '../../ui/form.tsx'

/** A choice in the owner select: `collectif:<id>` or `me`. */
export interface OwnerOption {
  value: string
  label: string
}

/** Values shown in the location form. */
export interface LocationFormValues {
  owner: string
  name: string
  city: string
  address: string
  notes: string
}

/** Props of the location form, shared by creation and edition. */
export interface LocationFormProps {
  action: string
  csrfToken: string
  values: LocationFormValues
  errors?: FieldErrors
  /** Only on creation: the owner never changes afterwards. */
  ownerOptions?: OwnerOption[]
  submitLabel: string
}

/** Name, city, address and notes of a storage location. */
export function LocationForm(handle: Handle<LocationFormProps>) {
  return () => {
    const { action, csrfToken, values, errors = {}, ownerOptions, submitLabel } = handle.props
    return (
      <>
        <ErrorSummary errors={errors} />
        <form method="post" action={action} class="stack">
          <CsrfField token={csrfToken} />
          {ownerOptions ? (
            <div class={errors.owner ? 'field field-invalid' : 'field'}>
              <label for="field-owner">Ce lieu appartient à</label>
              <select id="field-owner" name="owner">
                {ownerOptions.map((option) => (
                  <option
                    key={option.value}
                    value={option.value}
                    selected={option.value === values.owner}
                  >
                    {option.label}
                  </option>
                ))}
              </select>
              {errors.owner ? <p class="error">{errors.owner}</p> : null}
            </div>
          ) : null}
          <TextField
            name="name"
            label="Nom du lieu"
            value={values.name}
            error={errors.name}
            required
            maxLength={120}
            hint="Par exemple : « Local de la rue Dupont », « Garage de Camille »."
          />
          <TextField
            name="city"
            label="Ville"
            value={values.city}
            error={errors.city}
            required
            maxLength={120}
            hint="La seule information visible par ceux qui voient le matériel rangé ici."
          />
          <TextField
            name="address"
            label="Adresse"
            value={values.address}
            error={errors.address}
            maxLength={300}
            hint="Visible seulement par les gestionnaires de ce lieu et les administrateurs."
          />
          <TextArea
            name="notes"
            label="Notes"
            value={values.notes}
            error={errors.notes}
            maxLength={2000}
            hint="Accès, horaires, code… visible par les gestionnaires de ce lieu."
          />
          <button type="submit">{submitLabel}</button>
        </form>
      </>
    )
  }
}
