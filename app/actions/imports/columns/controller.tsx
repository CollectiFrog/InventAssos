import type { Handle } from 'remix/component'
import { getCsrfToken } from 'remix/middleware/csrf'
import { redirect } from 'remix/response/redirect'
import { createController } from 'remix/router'
import { saveTemplate } from '../../../data/import-templates.ts'
import { type PendingImport, saveImportMapping } from '../../../data/imports.ts'
import type { AppContext } from '../../../middleware/index.ts'
import { routes } from '../../../routes.ts'
import { CsrfField, ErrorSummary, type FieldErrors } from '../../../ui/form.tsx'
import type { Viewer } from '../../../ui/layout.tsx'
import { formValue } from '../../../validation.ts'
import { viewerOf } from '../../viewer.ts'
import { headerKey } from '../columns.ts'
import {
  type InventoryField,
  inventoryFields,
  inventoryHeaders,
  toColumnMapping,
} from '../format.ts'
import {
  frenchTime,
  ImportLayout,
  type ImportLocation,
  importSteps,
  loadImport,
} from '../shared.tsx'
import { crowdedValueColumns, maxDistinctValues } from '../value-choices.ts'
import { loadValueWorld } from '../world.ts'

/** What each field is called in the select. */
const fieldOptions = inventoryFields.map((field) => ({
  value: field,
  label: inventoryHeaders[field],
}))

/** A column's title as shown: its own, or its letter when it has none (« Colonne C »). */
function columnTitle(header: readonly string[], index: number): string {
  const title = header[index]?.trim()
  if (title) return title
  let letters = ''
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) {
    letters = String.fromCharCode(65 + ((n - 1) % 26)) + letters
  }
  return `Colonne ${letters} (sans titre)`
}

/** Up to three non-blank values of a column, to recognise it. */
function samples(pending: PendingImport, index: number): string[] {
  const found: string[] = []
  for (const row of pending.rows) {
    const value = row.cells[index]?.trim()
    if (value) found.push(value.length > 40 ? `${value.slice(0, 40)}…` : value)
    if (found.length === 3) break
  }
  return found
}

interface ColumnsPageProps {
  viewer: Viewer
  csrfToken: string
  pending: PendingImport
  location: ImportLocation
  /** The field chosen for each column, as submitted or saved. */
  choices: (string | null)[]
  errors: FieldErrors
  notice?: string
}

/** Step 2 (US-0.10.1): the field each column of the file holds, guessed then the person's. */
function ColumnsPage(handle: Handle<ColumnsPageProps>) {
  return () => {
    const { viewer, csrfToken, pending, location, choices, errors, notice } = handle.props
    const { header } = pending
    return (
      <ImportLayout
        viewer={viewer}
        title="Colonnes du fichier"
        location={location}
        steps={importSteps(2, pending.id)}
      >
        {notice ? (
          <p class="notice notice-success" role="status">
            {notice}
          </p>
        ) : null}
        <ErrorSummary errors={errors} />
        <p class="status">
          « {pending.fileName} » · {pending.rows.length.toLocaleString('fr-FR')}{' '}
          {pending.rows.length > 1 ? 'lignes' : 'ligne'} · ranger dans « {location.name} » (
          {location.ownerName}) · fichier gardé jusqu’à {frenchTime(pending.expiresAt)}
        </p>
        {header.length === 1 ? (
          <p class="notice">
            Une seule colonne a été trouvée : le fichier utilise peut-être un autre séparateur.
            Enregistrez-le en CSV avec des points-virgules, puis envoyez-le à nouveau.
          </p>
        ) : null}
        <form
          method="post"
          action={routes.imports.columns.action.href({ importId: pending.id })}
          class="stack form-wide"
        >
          <CsrfField token={csrfToken} />
          <table class="data-table mapping-table">
            <caption>
              Choisissez ce que contient chaque colonne. Les colonnes marquées « à vérifier » n’ont
              pas été reconnues.
            </caption>
            <thead>
              <tr>
                <th scope="col">Colonne du fichier</th>
                <th scope="col">Exemples</th>
                <th scope="col">Correspond à</th>
              </tr>
            </thead>
            <tbody>
              {header.map((_, index) => {
                const id = `field-col-${index}`
                const error = errors[`col-${index}`]
                const choice = choices[index] ?? ''
                return (
                  <tr key={id}>
                    <th scope="row" data-label="Colonne du fichier">
                      <label for={id}>{columnTitle(header, index)}</label>
                      {choice === '' ? <span class="status"> · à vérifier</span> : null}
                    </th>
                    <td data-label="Exemples" class="sample">
                      {samples(pending, index).join(' · ') || '(vide)'}
                    </td>
                    <td data-label="Correspond à">
                      <select
                        id={id}
                        name={`col-${index}`}
                        aria-invalid={error ? 'true' : undefined}
                        aria-describedby={error ? `${id}-error` : undefined}
                      >
                        <option value="">Ne pas importer</option>
                        {fieldOptions.map((option) => (
                          <option
                            key={option.value}
                            value={option.value}
                            selected={option.value === choice}
                          >
                            {option.label}
                          </option>
                        ))}
                      </select>
                      {error ? (
                        <p class="error" id={`${id}-error`}>
                          {error}
                        </p>
                      ) : null}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <p class="actions">
            <button type="submit">Valider les colonnes</button>
          </p>
        </form>
        <form
          method="post"
          action={routes.imports.cancel.href({ importId: pending.id })}
          class="actions"
        >
          <CsrfField token={csrfToken} />
          <button type="submit" class="secondary">
            Abandonner l’import
          </button>
        </form>
      </ImportLayout>
    )
  }
}

/**
 * Checks the submitted choices: a known field or nothing, each field once, and something to find
 * or name the items by (a name, a reference or an identifier).
 */
export function checkColumns(
  header: readonly string[],
  submitted: readonly string[],
): { choices: (InventoryField | null)[]; errors: FieldErrors } {
  const errors: FieldErrors = {}
  const choices = header.map((_, index): InventoryField | null => {
    const value = submitted[index] ?? ''
    if (value === '') return null
    if (!(inventoryFields as readonly string[]).includes(value)) {
      errors[`col-${index}`] = 'Choix inconnu.'
      return null
    }
    return value as InventoryField
  })
  choices.forEach((field, index) => {
    if (field === null) return
    const first = choices.indexOf(field)
    if (first !== index) {
      errors[`col-${index}`] =
        `« ${inventoryHeaders[field]} » est déjà choisi pour « ${columnTitle(header, first)} ».`
    }
  })
  if (!choices.some((field) => field === 'name' || field === 'ref' || field === 'id')) {
    errors['col-0'] ??=
      'Choisissez au moins la colonne du nom (ou celle de la référence, ou de l’identifiant).'
  }
  return { choices, errors }
}

/** The error under each value column holding too many different values. */
function crowdedErrors(
  rows: PendingImport['rows'],
  choices: readonly (InventoryField | null)[],
): FieldErrors {
  const errors: FieldErrors = {}
  for (const index of crowdedValueColumns(rows, choices)) {
    const field = choices[index]
    if (!field) continue
    errors[`col-${index}`] =
      `Plus de ${maxDistinctValues} valeurs différentes : est-ce bien la colonne « ${inventoryHeaders[field]} » ?`
  }
  return errors
}

async function render(
  context: AppContext,
  loaded: { pending: PendingImport; location: ImportLocation },
  choices: (string | null)[],
  errors: FieldErrors = {},
  status = Object.keys(errors).length > 0 ? 400 : 200,
) {
  const notice = context.session.get('notice')
  return context.render(
    <ColumnsPage
      viewer={viewerOf(context)}
      csrfToken={getCsrfToken(context)}
      pending={loaded.pending}
      location={loaded.location}
      choices={choices}
      errors={errors}
      notice={typeof notice === 'string' ? notice : undefined}
    />,
    { status },
  )
}

/** Step 2 of the import (US-0.10.1, ADR 0026). */
export default createController(routes.imports.columns, {
  actions: {
    async index(context) {
      const loaded = await loadImport(context, context.params.importId)
      if (loaded instanceof Response) return loaded
      // A value column with too many values is shown at once, before anything is submitted.
      const columns = toColumnMapping(loaded.pending.columnMapping)
      const errors = crowdedErrors(loaded.pending.rows, columns)
      return render(context, loaded, loaded.pending.columnMapping, errors, 200)
    },

    async action(context) {
      const loaded = await loadImport(context, context.params.importId)
      if (loaded instanceof Response) return loaded
      const { header } = loaded.pending
      const submitted = header.map((_, index) => formValue(context.formData, `col-${index}`))
      const { choices, errors } = checkColumns(header, submitted)
      Object.assign(errors, crowdedErrors(loaded.pending.rows, choices))
      if (Object.keys(errors).length > 0) return render(context, loaded, submitted, errors)

      // Values the person already chose for this import stay; the others are guessed afresh.
      const { db } = context
      const world = await loadValueWorld(db, loaded.actor, loaded.location)
      await saveImportMapping(db, loaded.pending.id, { columnMapping: choices })
      // Saved when validated (ADR 0027): a corrected file is mapped the same way.
      const columnMap: Record<string, string> = {}
      header.forEach((title, index) => {
        const key = headerKey(title)
        if (key !== '') columnMap[key] = choices[index] ?? ''
      })
      await saveTemplate(db, world.owner, { columnMap }, loaded.actor.id)
      return redirect(routes.imports.values.index.href({ importId: loaded.pending.id }), 303)
    },
  },
})
