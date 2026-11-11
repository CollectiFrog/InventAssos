import type { Handle } from 'remix/component'

import { itemConditions } from '../../data/tables.ts'
import {
  type FieldErrors,
  SelectField,
  type SelectOption,
  TextArea,
  TextField,
} from '../../ui/form.tsx'
import { conditionLabels } from '../../ui/labels.ts'
import type { ItemFormValues } from './schema.ts'

const conditionOptions = itemConditions.map((value) => ({ value, label: conditionLabels[value] }))

/** The descriptive inputs of the item form (no owner, no location). */
export function ItemFields(
  handle: Handle<{ values: ItemFormValues; errors: FieldErrors; categories: SelectOption[] }>,
) {
  return () => {
    const { values, errors, categories } = handle.props
    // Wizard template (ADR 0022): two fields per row when the form is wide enough.
    return (
      <div class="field-grid">
        <TextField
          name="name"
          label="Nom"
          value={values.name}
          error={errors.name}
          required
          maxLength={120}
        />
        <SelectField
          name="categoryId"
          label="Catégorie"
          options={categories}
          value={values.categoryId}
          error={errors.categoryId}
          required
        />
        <TextField
          name="quantity"
          label="Quantité"
          type="number"
          value={values.quantity}
          error={errors.quantity}
          required
          hint="Pour un lot d’objets identiques."
        />
        <TextField
          name="brand"
          label="Marque"
          value={values.brand}
          error={errors.brand}
          maxLength={120}
        />
        <TextField
          name="model"
          label="Modèle"
          value={values.model}
          error={errors.model}
          maxLength={120}
        />
        <TextField
          name="serialNumber"
          label="Numéro de série"
          value={values.serialNumber}
          error={errors.serialNumber}
          maxLength={120}
        />
        <SelectField
          name="condition"
          label="État"
          options={conditionOptions}
          value={values.condition}
          error={errors.condition}
          emptyLabel="Non précisé"
        />
        <TextField
          name="estimatedValue"
          label="Valeur estimée (€)"
          value={values.estimatedValue}
          error={errors.estimatedValue}
          maxLength={12}
        />
        <TextArea
          name="description"
          label="Description"
          value={values.description}
          error={errors.description}
          maxLength={2000}
        />
      </div>
    )
  }
}
