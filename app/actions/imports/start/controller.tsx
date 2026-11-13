import type { Handle } from 'remix/component'
import { getCsrfToken } from 'remix/middleware/csrf'
import { redirect } from 'remix/response/redirect'
import { createController } from 'remix/router'

import { CsvError, decodeCsv, parseCsv, restoreNeutralized } from '../../../csv.ts'
import { findTemplate } from '../../../data/import-templates.ts'
import { createImport } from '../../../data/imports.ts'
import { findLocationWithOwner, type LocationWithOwner } from '../../../data/locations.ts'
import type { AppContext } from '../../../middleware/index.ts'
import { canImportInto, isValidatedUser } from '../../../permissions.ts'
import { hitUpload } from '../../../rate-limits.ts'
import { routes } from '../../../routes.ts'
import { CsrfField, SelectField } from '../../../ui/form.tsx'
import type { Viewer } from '../../../ui/layout.tsx'
import { formValue } from '../../../validation.ts'
import { forbidden, requireUser, tooManyRequests } from '../../guards.tsx'
import { viewerOf } from '../../viewer.ts'
import { guessColumns } from '../columns.ts'
import { ImportLayout, importableLocations, importSteps } from '../shared.tsx'
import { allValuesSure, guessValues } from '../value-choices.ts'
import { loadValueWorld } from '../world.ts'

/** Most rows of data in a file (ADR 0026), the title row not counted. */
export const maxImportRows = 2000
/** Most columns in a file. */
export const maxImportColumns = 50
/** Longest cell kept: one more than the longest field, so « too long » is still reported. */
const maxCell = 2001

/** Why a file is refused, in French, shown under the file field. */
class FileRefused extends Error {}

interface StartPageProps {
  viewer: Viewer
  csrfToken: string
  locations: LocationWithOwner[]
  locationId?: string
  error?: string
}

/** Step 1 (US-0.10.1): where the items go, and the file. */
function StartPage(handle: Handle<StartPageProps>) {
  return () => {
    const { viewer, csrfToken, locations, locationId, error } = handle.props
    const chosen = locations.find((location) => location.id === locationId)
    return (
      <ImportLayout
        viewer={viewer}
        title="Importer un fichier"
        location={chosen ? { ownerName: chosen.ownerName, ownerSlug: null } : null}
        steps={importSteps(1)}
      >
        {locations.length === 0 ? (
          <div class="card empty-state">
            <p>
              Pour importer du matériel, il faut un lieu où le ranger : un des vôtres, ou un lieu
              d’un collectif dont vous êtes responsable.
            </p>
            <a class="button" href={routes.locations.create.index.href()}>
              Créez d’abord un lieu
            </a>
          </div>
        ) : (
          <form
            method="post"
            action={routes.imports.start.action.href()}
            encType="multipart/form-data"
            class="stack form-wide"
          >
            <CsrfField token={csrfToken} />
            <SelectField
              name="locationId"
              label="Ranger dans"
              options={locations.map((location) => ({
                value: location.id,
                label: `${location.name} · ${location.city} (${location.ownerName})`,
              }))}
              value={locationId}
              required
              hint="Le matériel du fichier appartiendra au propriétaire de ce lieu. Une colonne « Lieu » peut en désigner un autre du même propriétaire."
            />
            <div class={error ? 'field field-invalid' : 'field'}>
              <label for="field-fichier">Fichier CSV</label>
              <p class="hint" id="field-fichier-hint">
                2 Mo et {maxImportRows.toLocaleString('fr-FR')} lignes au plus. La première ligne
                contient les titres des colonnes. Depuis Excel ou LibreOffice : Enregistrer sous ›
                CSV.
              </p>
              <input
                id="field-fichier"
                name="fichier"
                type="file"
                accept=".csv,text/csv"
                required
                aria-invalid={error ? 'true' : undefined}
                aria-describedby={
                  error ? 'field-fichier-hint field-fichier-error' : 'field-fichier-hint'
                }
              />
              {error ? (
                <p class="error" id="field-fichier-error">
                  {error}
                </p>
              ) : null}
            </div>
            <p>
              <button type="submit">Envoyer le fichier</button>
            </p>
            <p class="status">
              Rien n’est ajouté avant la dernière étape : vous vérifierez chaque ligne d’abord.{' '}
              <a href="/modele-import.csv" download>
                Télécharger un modèle vide
              </a>
              .
            </p>
          </form>
        )}
      </ImportLayout>
    )
  }
}

/** Reads the first bytes: a spreadsheet saved in its own format says so before anything else. */
function refuseOtherFormats(bytes: Uint8Array): void {
  const starts = (...signature: number[]) => signature.every((byte, i) => bytes[i] === byte)
  if (starts(0x50, 0x4b, 0x03, 0x04) || starts(0xd0, 0xcf, 0x11, 0xe0)) {
    throw new FileRefused(
      'C’est un classeur (.xlsx, .ods ou .xls). Enregistrez-le au format CSV, puis envoyez ce fichier.',
    )
  }
  if (starts(0xff, 0xfe) || starts(0xfe, 0xff)) {
    throw new FileRefused('Ce fichier est encodé en UTF-16 : enregistrez-le en « CSV UTF-8 ».')
  }
}

/** The name shown beside the import: never used in a path or a header. */
function displayName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? ''
  return [...base]
    .filter((character) => character.charCodeAt(0) >= 32)
    .join('')
    .slice(0, 120)
}

/** The file's rows, checked: a title row, then at least one row of data. */
async function readFile(file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer())
  refuseOtherFormats(bytes)
  let table: ReturnType<typeof parseCsv>
  try {
    table = parseCsv(decodeCsv(bytes), {
      maxRows: maxImportRows + 1,
      maxColumns: maxImportColumns,
    })
  } catch (error) {
    if (error instanceof CsvError) throw new FileRefused(error.message)
    throw error
  }
  const [header = [], ...data] = table.rows
  if (data.length === 0) throw new FileRefused('Ce fichier ne contient aucune ligne à importer.')
  const cell = (value: string) => restoreNeutralized(value).slice(0, maxCell)
  return {
    header: header.map(cell),
    rows: data.map((cells, index) => ({
      n: table.numbers[index + 1] ?? index + 2,
      cells: cells.map(cell),
    })),
  }
}

/** Re-shows step 1 with what was chosen and why the file was refused. */
async function render(
  context: AppContext,
  options: { locationId?: string; error?: string; status?: number } = {},
) {
  const actor = context.currentUser
  if (!isValidatedUser(actor)) return forbidden(context)
  return context.render(
    <StartPage
      viewer={viewerOf(context)}
      csrfToken={getCsrfToken(context)}
      locations={await importableLocations(context.db, actor)}
      locationId={options.locationId}
      error={options.error}
    />,
    { status: options.status ?? 200 },
  )
}

/** Step 1 of the import (US-0.10.1, US-0.10.5, ADR 0026). */
export default createController(routes.imports.start, {
  actions: {
    async index(context) {
      const actor = requireUser(context)
      if (actor instanceof Response) return actor
      if (!isValidatedUser(actor)) return forbidden(context)

      const params = context.url.searchParams
      const locations = await importableLocations(context.db, actor)
      // Preselected from the page that leads here: a location, or a collectif's first one.
      const forCollectif = params.get('pour')?.replace(/^collectif:/, '')
      const locationId =
        locations.find((location) => location.id === params.get('lieu'))?.id ??
        locations.find((location) => location.collectif_id === forCollectif)?.id
      return render(context, {
        locationId,
        error:
          params.get('erreur') === 'taille'
            ? 'Ce fichier dépasse 2 Mo : enregistrez moins de lignes, ou retirez des colonnes.'
            : undefined,
      })
    },

    async action(context) {
      const actor = requireUser(context)
      if (actor instanceof Response) return actor
      if (!isValidatedUser(actor)) return forbidden(context)

      const { db, formData, settings } = context
      const locationId = formValue(formData, 'locationId')
      const location = await findLocationWithOwner(db, locationId)
      // To import into a location you must manage it: refused, not ignored (as the add form).
      if (location === null || !canImportInto(actor, location)) return forbidden(context)
      const limit = await hitUpload(db, settings, actor.id)
      if (!limit.allowed) return tooManyRequests(context, limit.retryAfterSeconds)

      const file = formData.get('fichier')
      if (!(file instanceof File) || file.size === 0) {
        return render(context, { locationId, error: 'Choisissez un fichier CSV.', status: 400 })
      }
      let content: Awaited<ReturnType<typeof readFile>>
      try {
        content = await readFile(file)
      } catch (error) {
        if (!(error instanceof FileRefused)) throw error
        return render(context, { locationId, error: error.message, status: 400 })
      }

      // Guessed with what this owner chose last time (US-0.10.1), then shown to be checked.
      const world = await loadValueWorld(db, actor, location)
      const template = await findTemplate(db, world.owner)
      const guesses = guessColumns(content.header, template.columnMap)
      const columnMapping = guesses.map((guess) => guess.field)
      const importId = await createImport(db, {
        createdBy: actor.id,
        locationId: location.id,
        fileName: displayName(file.name) || 'fichier.csv',
        header: content.header,
        rows: content.rows,
        columnMapping,
      })
      // A file mapped as before goes straight to the preview; else to the first step to check.
      const columnsSure = guesses.every(
        (guess, index) =>
          content.header[index]?.trim() === '' ||
          guess.source === 'saved' ||
          guess.source === 'own' ||
          guess.source === 'exact',
      )
      const valuesSure = allValuesSure(
        guessValues(content.rows, columnMapping, world, template.valueMap),
      )
      return redirect(
        !columnsSure
          ? routes.imports.columns.index.href({ importId })
          : !valuesSure
            ? routes.imports.values.index.href({ importId })
            : routes.imports.preview.index.href({ importId }),
        303,
      )
    },
  },
})
