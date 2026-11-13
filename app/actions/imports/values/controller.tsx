import type { Handle } from 'remix/component'
import { getCsrfToken } from 'remix/middleware/csrf'
import { redirect } from 'remix/response/redirect'
import { createController } from 'remix/router'

import { findTemplate, saveTemplate } from '../../../data/import-templates.ts'
import { type PendingImport, saveImportMapping } from '../../../data/imports.ts'
import { itemConditions } from '../../../data/tables.ts'
import type { AppContext } from '../../../middleware/index.ts'
import { routes } from '../../../routes.ts'
import { CsrfField, ErrorSummary, type FieldErrors } from '../../../ui/form.tsx'
import { conditionLabels } from '../../../ui/labels.ts'
import type { Viewer } from '../../../ui/layout.tsx'
import { formValue } from '../../../validation.ts'
import { viewerOf } from '../../viewer.ts'
import { inventoryHeaders, toColumnMapping } from '../format.ts'
import { ImportLayout, type ImportLocation, importSteps, loadImport } from '../shared.tsx'
import {
  guessValues,
  toValueMapping,
  type ValueChoice,
  type ValueChoices,
  type ValueKind,
  valueKinds,
} from '../value-choices.ts'
import { loadValueWorld } from '../world.ts'

/** A select's field name: its kind and its value's key (folded: letters, digits and spaces). */
const fieldName = (kind: ValueKind, key: string) => `${kind}:${key}`

/** The options of each kind of value. */
interface Options {
  category: { value: string; label: string }[]
  condition: { value: string; label: string }[]
  location: { value: string; label: string }[]
}

const titles: Record<ValueKind, string> = {
  category: 'Catégories',
  condition: 'États',
  location: 'Lieux',
}

interface ValuesPageProps {
  viewer: Viewer
  csrfToken: string
  pending: PendingImport
  location: ImportLocation
  choices: ValueChoices
  options: Options
  errors: FieldErrors
  notice?: string
}

/**
 * Step 3 (US-0.10.1): what each value of the category, condition and location columns stands for,
 * guessed then the person's; the unsure ones first.
 */
function ValuesPage(handle: Handle<ValuesPageProps>) {
  return () => {
    const { viewer, csrfToken, pending, location, choices, options, errors, notice } = handle.props
    const kinds = valueKinds.filter((kind) => choices[kind].length > 0)
    const unsure = (value: ValueChoice) => value.source === 'fallback' || value.source === 'loose'
    return (
      <ImportLayout
        viewer={viewer}
        title="Catégories, états et lieux"
        location={location}
        steps={importSteps(3, pending.id)}
      >
        {notice ? (
          <p class="notice notice-success" role="status">
            {notice}
          </p>
        ) : null}
        <ErrorSummary errors={errors} />
        <form
          method="post"
          action={routes.imports.values.action.href({ importId: pending.id })}
          class="stack form-wide"
        >
          <CsrfField token={csrfToken} />
          {kinds.length === 0 ? (
            <p>
              Aucune colonne de catégorie, d’état ou de lieu : les objets créés iront dans la
              catégorie « Autre », sans état, dans « {location.name} ».
            </p>
          ) : null}
          {kinds.map((kind) => {
            const sorted = [...choices[kind]].sort((a, b) => Number(unsure(b)) - Number(unsure(a)))
            return (
              <section aria-labelledby={`valeurs-${kind}`}>
                <h2 id={`valeurs-${kind}`}>
                  {titles[kind]} · {sorted.length}
                </h2>
                <table class="data-table mapping-table">
                  <caption class="visually-hidden">
                    {titles[kind]} du fichier (colonne « {inventoryHeaders[kind]} »)
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Dans le fichier</th>
                      <th scope="col">Lignes</th>
                      <th scope="col">Devient</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((value) => {
                      const name = fieldName(kind, value.key)
                      const id = `field-${kind}-${value.key.replaceAll(' ', '-')}`
                      const error = errors[name]
                      return (
                        <tr key={name}>
                          <th scope="row" data-label="Dans le fichier">
                            <label for={id}>{value.label}</label>
                            {unsure(value) ? <span class="status"> · à vérifier</span> : null}
                          </th>
                          <td data-label="Lignes" class="num">
                            {value.count}
                          </td>
                          <td data-label="Devient">
                            <select
                              id={id}
                              name={name}
                              aria-invalid={error ? 'true' : undefined}
                              aria-describedby={error ? `${id}-error` : undefined}
                            >
                              {options[kind].map((option) => (
                                <option
                                  key={option.value}
                                  value={option.value}
                                  selected={option.value === value.choice}
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
              </section>
            )
          })}
          <p class="actions">
            <a
              class="button secondary"
              href={routes.imports.columns.index.href({ importId: pending.id })}
            >
              ← Colonnes
            </a>
            <button type="submit">Valider</button>
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

/** Loads the import, the values of its value columns with their choices, and the options. */
async function load(context: AppContext, importId: string) {
  const loaded = await loadImport(context, importId)
  if (loaded instanceof Response) return loaded
  const world = await loadValueWorld(context.db, loaded.actor, loaded.location)
  const template = await findTemplate(context.db, world.owner)
  const choices = guessValues(
    loaded.pending.rows,
    toColumnMapping(loaded.pending.columnMapping),
    world,
    template.valueMap,
    loaded.pending.valueMapping,
  )
  const options: Options = {
    category: world.categories.map((category) => ({ value: category.id, label: category.name })),
    condition: [
      { value: '', label: 'Non précisé' },
      ...itemConditions.map((condition) => ({
        value: condition,
        label: conditionLabels[condition],
      })),
    ],
    location: [
      { value: '', label: `Le lieu de l’import (${loaded.location.name})` },
      ...world.locations
        .filter((place) => place.id !== loaded.location.id)
        .map((place) => ({ value: place.id, label: place.name })),
    ],
  }
  return { ...loaded, world, choices, options }
}

function render(
  context: AppContext,
  loaded: Exclude<Awaited<ReturnType<typeof load>>, Response>,
  choices: ValueChoices,
  errors: FieldErrors = {},
) {
  const notice = context.session.get('notice')
  return context.render(
    <ValuesPage
      viewer={viewerOf(context)}
      csrfToken={getCsrfToken(context)}
      pending={loaded.pending}
      location={loaded.location}
      choices={choices}
      options={loaded.options}
      errors={errors}
      notice={typeof notice === 'string' ? notice : undefined}
    />,
    { status: Object.keys(errors).length > 0 ? 400 : 200 },
  )
}

/** Step 3 of the import (US-0.10.1, ADR 0027). */
export default createController(routes.imports.values, {
  actions: {
    async index(context) {
      const loaded = await load(context, context.params.importId)
      if (loaded instanceof Response) return loaded
      return render(context, loaded, loaded.choices)
    },

    async action(context) {
      const loaded = await load(context, context.params.importId)
      if (loaded instanceof Response) return loaded
      const errors: FieldErrors = {}
      const submitted = { ...loaded.choices }
      for (const kind of valueKinds) {
        const allowed = new Set(loaded.options[kind].map((option) => option.value))
        submitted[kind] = loaded.choices[kind].map((value) => {
          const name = fieldName(kind, value.key)
          const choice = formValue(context.formData, name)
          if (!allowed.has(choice)) {
            errors[name] = 'Choix inconnu.'
            return value
          }
          return { ...value, choice, source: 'saved' as const }
        })
      }
      if (Object.keys(errors).length > 0) return render(context, loaded, submitted, errors)

      const valueMapping = toValueMapping(submitted)
      await saveImportMapping(context.db, loaded.pending.id, { valueMapping })
      // Saved when validated (ADR 0027): the owner's next file starts from these choices.
      await saveTemplate(
        context.db,
        loaded.world.owner,
        { valueMap: valueMapping },
        loaded.actor.id,
      )
      return redirect(routes.imports.preview.index.href({ importId: loaded.pending.id }), 303)
    },
  },
})
