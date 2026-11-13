import { createHash } from 'node:crypto'

import type { Handle } from 'remix/component'
import type { Database } from 'remix/data-table'
import { getCsrfToken } from 'remix/middleware/csrf'
import { redirect } from 'remix/response/redirect'
import { createController } from 'remix/router'

import { type AuditEntry, logActions } from '../../../data/audit-log.ts'
import {
  deleteImport,
  findImport,
  type PendingImport,
  setForcedRow,
} from '../../../data/imports.ts'
import {
  createItems,
  isRefConflict,
  type NewItem,
  updateImportedItem,
} from '../../../data/items.ts'
import type { CurrentUser } from '../../../middleware/current-user.ts'
import type { AppContext } from '../../../middleware/index.ts'
import { routes } from '../../../routes.ts'
import { CsrfField } from '../../../ui/form.tsx'
import type { Viewer } from '../../../ui/layout.tsx'
import { Pagination } from '../../../ui/pagination.tsx'
import { formValue } from '../../../validation.ts'
import { viewerOf } from '../../viewer.ts'
import { toColumnMapping } from '../format.ts'
import { type ImportPlan, type PlannedRow, planImport } from '../plan.ts'
import {
  ImportLayout,
  type ImportLocation,
  importNotFound,
  importSteps,
  landingHref,
  loadImport,
} from '../shared.tsx'
import { loadImportWorld, ownerOfLocation } from '../world.ts'

/** Rows shown per page of the preview. */
const pageSize = 50

/** What the preview can show, as `?voir=`. */
const views = {
  erreurs: { label: 'À corriger', states: ['invalid'] },
  avertissements: { label: 'Avertissements', states: [] },
  creations: { label: 'À créer', states: ['create'] },
  modifications: { label: 'À modifier', states: ['update'] },
  archives: { label: 'Objets archivés', states: ['archived'] },
  inchangees: { label: 'Inchangés', states: ['unchanged'] },
  toutes: { label: 'Toutes', states: [] },
} as const
type View = keyof typeof views

/** The rows a view shows. */
function rowsOf(plan: ImportPlan, view: View): PlannedRow[] {
  if (view === 'toutes') return plan.rows
  if (view === 'avertissements') return plan.rows.filter((row) => row.warnings.length > 0)
  const states: readonly string[] = views[view].states
  return plan.rows.filter((row) => states.includes(row.state))
}

/** The plan's fingerprint, posted back with the confirmation to detect a changed inventory. */
function signatureOf(plan: ImportPlan): string {
  // Every row's outcome, not only the counts: two plans with the same counts may write
  // different things (another item changed in between).
  const outcome = plan.rows.map((row) => [
    row.n,
    row.state,
    row.itemId,
    row.locationId,
    row.fromLocationId,
    row.changed,
    row.fields,
  ])
  return createHash('sha256').update(JSON.stringify(outcome)).digest('base64url')
}

/** « 1 240 ». */
const count = (n: number) => n.toLocaleString('fr-FR')

const stateLabels: Record<PlannedRow['state'], string> = {
  create: 'À créer',
  update: 'À modifier',
  unchanged: 'Inchangé',
  archived: 'Objet archivé',
  invalid: 'À corriger',
}

/** Field columns as the history and the detail cell name them. */
const changedLabels: Record<string, string> = {
  name: 'nom',
  category_id: 'catégorie',
  quantity: 'quantité',
  brand: 'marque',
  model: 'modèle',
  serial_number: 'numéro de série',
  ref: 'référence',
  condition: 'état',
  estimated_value: 'valeur',
  description: 'description',
}

interface PreviewPageProps {
  viewer: Viewer
  csrfToken: string
  pending: PendingImport
  location: ImportLocation
  plan: ImportPlan
  view: View
  page: number
  notice?: string
  error?: string
}

/** Step 4 (US-0.10.2): what the import will do, counts first, then the rows; nothing written yet. */
function PreviewPage(handle: Handle<PreviewPageProps>) {
  return () => {
    const { viewer, csrfToken, pending, location, plan, view, page, notice, error } = handle.props
    const { counts } = plan
    const shown = rowsOf(plan, view)
    const pageCount = Math.max(1, Math.ceil(shown.length / pageSize))
    const current = Math.min(page, pageCount)
    const slice = shown.slice((current - 1) * pageSize, current * pageSize)
    const href = (next: { voir?: View; page?: number }) => {
      const query = new URLSearchParams({ voir: next.voir ?? view })
      if ((next.page ?? 1) > 1) query.set('page', String(next.page))
      return `${routes.imports.preview.index.href({ importId: pending.id })}?${query}`
    }
    const toWrite = counts.create + counts.update
    return (
      <ImportLayout
        viewer={viewer}
        title="Vérification de l’import"
        location={location}
        steps={importSteps(4, pending.id)}
      >
        {notice ? (
          <p class="notice notice-success" role="status">
            {notice}
          </p>
        ) : null}
        {error ? (
          <p class="notice notice-error" role="alert">
            {error}
          </p>
        ) : null}
        <p class="summary-line">
          <strong>{count(counts.create)}</strong> à créer · <strong>{count(counts.update)}</strong>{' '}
          à modifier
          {counts.moved > 0 ? ` (dont ${count(counts.moved)} déplacés)` : ''} ·{' '}
          <strong>{count(counts.unchanged)}</strong> inchangés ·{' '}
          <strong>{count(counts.archived)}</strong> archivés mis de côté ·{' '}
          <strong>{count(counts.invalid)}</strong> à corriger · {count(counts.warnings)}{' '}
          avertissements
        </p>
        <nav aria-label="Lignes à afficher" class="chips">
          {(Object.keys(views) as View[]).map((key) => (
            <a
              href={href({ voir: key })}
              class="chip"
              aria-current={key === view ? 'page' : undefined}
            >
              {views[key].label} ({count(rowsOf(plan, key).length)})
            </a>
          ))}
        </nav>
        <table class="data-table">
          <caption>
            Lignes du fichier « {pending.fileName} » : {views[view].label.toLowerCase()}
          </caption>
          <thead>
            <tr>
              <th scope="col" class="num">
                Ligne
              </th>
              <th scope="col">État</th>
              <th scope="col">Référence</th>
              <th scope="col">Nom</th>
              <th scope="col">Catégorie</th>
              <th scope="col" class="num">
                Quantité
              </th>
              <th scope="col">Lieu</th>
              <th scope="col">Détail</th>
            </tr>
          </thead>
          <tbody>
            {slice.map((row) => (
              <tr key={row.n}>
                <td data-label="Ligne" class="num">
                  {row.n}
                </td>
                <td data-label="État">{stateLabels[row.state]}</td>
                <td data-label="Référence">{cut(row.ref)}</td>
                <td data-label="Nom">{cut(row.name)}</td>
                <td data-label="Catégorie">{row.categoryName}</td>
                <td data-label="Quantité" class="num">
                  {row.quantity}
                </td>
                <td data-label="Lieu">{row.locationName}</td>
                <td data-label="Détail">
                  <Detail row={row} csrfToken={csrfToken} importId={pending.id} pending={pending} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {slice.length === 0 ? <p class="status">Aucune ligne ici.</p> : null}
        <Pagination page={current} pageCount={pageCount} hrefFor={(next) => href({ page: next })} />
        <aside aria-labelledby="confirmer" class="card stack">
          <h2 id="confirmer">Importer</h2>
          {counts.invalid > 0 ? (
            <>
              <p>
                {count(counts.invalid)} {counts.invalid > 1 ? 'lignes sont' : 'ligne est'} à
                corriger : rien ne sera importé tant qu’il en reste. Corrigez-les dans votre
                tableur, puis envoyez le fichier corrigé.
              </p>
              <form
                method="post"
                action={routes.imports.start.action.href()}
                encType="multipart/form-data"
                class="stack"
              >
                <CsrfField token={csrfToken} />
                <input type="hidden" name="locationId" value={location.id} />
                <label for="field-fichier">Fichier corrigé</label>
                <input
                  id="field-fichier"
                  name="fichier"
                  type="file"
                  accept=".csv,text/csv"
                  required
                />
                <button type="submit">Envoyer le fichier corrigé</button>
              </form>
              <p>
                <a href={routes.imports.columns.index.href({ importId: pending.id })}>
                  Modifier les correspondances
                </a>
              </p>
            </>
          ) : toWrite === 0 ? (
            <p>Rien à importer : tout est déjà à jour.</p>
          ) : (
            <form
              method="post"
              action={routes.imports.preview.action.href({ importId: pending.id })}
            >
              <CsrfField token={csrfToken} />
              <input type="hidden" name="intent" value="confirmer" />
              <input type="hidden" name="plan" value={signatureOf(plan)} />
              <button type="submit">
                Importer {count(toWrite)} {toWrite > 1 ? 'objets' : 'objet'}
              </button>
            </form>
          )}
          <form method="post" action={routes.imports.cancel.href({ importId: pending.id })}>
            <CsrfField token={csrfToken} />
            <button type="submit" class="secondary">
              Abandonner l’import
            </button>
          </form>
        </aside>
      </ImportLayout>
    )
  }
}

/** Cells are cut at 80 characters in the table. */
function cut(value: string): string {
  return value.length > 80 ? `${value.slice(0, 80)}…` : value
}

/** A row's errors, warnings, changes; for an archived row, the choice to add it anyway. */
function Detail(
  handle: Handle<{ row: PlannedRow; csrfToken: string; importId: string; pending: PendingImport }>,
) {
  return () => {
    const { row, csrfToken, importId, pending } = handle.props
    const forced = pending.forcedRows.includes(row.n)
    return (
      <>
        {row.errors.length > 0 ? (
          <ul class="error">
            {row.errors.map((message) => (
              <li>{message}</li>
            ))}
          </ul>
        ) : null}
        {row.warnings.length > 0 ? (
          <ul>
            {row.warnings.map((message) => (
              <li>{message}</li>
            ))}
          </ul>
        ) : null}
        {row.state === 'update' && row.changed.length > 0 ? (
          <p>Modifie : {row.changed.map((field) => changedLabels[field] ?? field).join(', ')}</p>
        ) : null}
        {row.state === 'update' && row.fromLocationId !== null ? <p>Déplacé</p> : null}
        {row.state === 'archived' || forced ? (
          <form method="post" action={routes.imports.preview.action.href({ importId })}>
            <CsrfField token={csrfToken} />
            <input type="hidden" name="intent" value={forced ? 'laisser' : 'forcer'} />
            <input type="hidden" name="ligne" value={String(row.n)} />
            {row.state === 'archived' ? (
              <p class="status">
                Cette référence est celle d’un objet archivé : la ligne n’est pas importée.
              </p>
            ) : null}
            <button type="submit" class="secondary">
              {forced ? 'Ne pas l’ajouter' : 'L’ajouter comme nouvel objet'}
            </button>
          </form>
        ) : null}
      </>
    )
  }
}

/** The plan of an import, from the database as it is now (inside a transaction when given one). */
async function planOf(
  db: Database,
  actor: CurrentUser,
  pending: PendingImport,
  location: ImportLocation,
): Promise<ImportPlan> {
  const columns = toColumnMapping(pending.columnMapping)
  const file = { header: pending.header, rows: pending.rows }
  const world = await loadImportWorld(db, actor, location, file, columns)
  return planImport(file, columns, pending.valueMapping, world, new Set(pending.forcedRows))
}

/** Thrown inside the confirmation to roll it back with a message for the person. */
class Refused extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
  }
}

/** Writes the plan: creations in bulk, updates one by one, every change in the history. */
async function writePlan(
  db: Database,
  actor: CurrentUser,
  pending: PendingImport,
  location: ImportLocation,
  plan: ImportPlan,
): Promise<{ created: number; updated: number }> {
  const owner = ownerOfLocation(location)
  const created: NewItem[] = []
  const entries: AuditEntry[] = []
  let updated = 0
  for (const row of plan.rows) {
    if (row.fields === null) continue
    if (row.state === 'create' && row.locationId) {
      const id = crypto.randomUUID()
      created.push({
        id,
        fields: row.fields,
        locationId: row.locationId,
        owner,
        createdBy: actor.id,
      })
      entries.push({
        actorId: actor.id,
        action: 'item.created',
        entity: 'item',
        entityId: id,
        payload: { locationId: row.locationId, importId: pending.id },
      })
    } else if (row.state === 'update' && row.itemId) {
      await updateImportedItem(db, row.itemId, row.fields, row.locationId)
      updated++
      if (row.changed.length > 0) {
        entries.push({
          actorId: actor.id,
          action: 'item.updated',
          entity: 'item',
          entityId: row.itemId,
          payload: { fields: row.changed.join(','), importId: pending.id },
        })
      }
      if (row.fromLocationId && row.locationId) {
        entries.push({
          actorId: actor.id,
          action: 'item.moved',
          entity: 'item',
          entityId: row.itemId,
          payload: {
            fromLocationId: row.fromLocationId,
            toLocationId: row.locationId,
            importId: pending.id,
          },
        })
      }
    }
  }
  await createItems(db, created)
  entries.push({
    actorId: actor.id,
    action: 'import.confirmed',
    entity: 'import',
    entityId: pending.id,
    payload: {
      ...('collectifId' in owner ? { collectifId: owner.collectifId } : { userId: owner.userId }),
      locationId: location.id,
      created: plan.counts.create,
      updated: plan.counts.update,
      moved: plan.counts.moved,
      unchanged: plan.counts.unchanged,
    },
  })
  await logActions(db, entries)
  await deleteImport(db, pending.id)
  return { created: created.length, updated }
}

async function render(
  context: AppContext,
  loaded: { actor: CurrentUser; pending: PendingImport; location: ImportLocation },
  options: { error?: string; status?: number } = {},
) {
  const plan = await planOf(context.db, loaded.actor, loaded.pending, loaded.location)
  const params = context.url.searchParams
  const asked = params.get('voir')
  const view: View =
    asked && Object.hasOwn(views, asked)
      ? (asked as View)
      : plan.counts.invalid > 0
        ? 'erreurs'
        : plan.counts.warnings > 0
          ? 'avertissements'
          : 'toutes'
  const page = Math.max(1, Math.min(1000, Number.parseInt(params.get('page') ?? '1', 10) || 1))
  const notice = context.session.get('notice')
  return context.render(
    <PreviewPage
      viewer={viewerOf(context)}
      csrfToken={getCsrfToken(context)}
      pending={loaded.pending}
      location={loaded.location}
      plan={plan}
      view={view}
      page={page}
      notice={typeof notice === 'string' ? notice : undefined}
      error={options.error}
    />,
    { status: options.status ?? 200 },
  )
}

/** Step 4 of the import: preview, archived rows forced in or left, confirmation (US-0.10.2). */
export default createController(routes.imports.preview, {
  actions: {
    async index(context) {
      const loaded = await loadImport(context, context.params.importId)
      if (loaded instanceof Response) return loaded
      return render(context, loaded)
    },

    async action(context) {
      const loaded = await loadImport(context, context.params.importId)
      if (loaded instanceof Response) return loaded
      const { actor, pending, location } = loaded
      const previewUrl = routes.imports.preview.index.href({ importId: pending.id })
      const intent = formValue(context.formData, 'intent')

      if (intent === 'forcer' || intent === 'laisser') {
        const n = Number.parseInt(formValue(context.formData, 'ligne'), 10)
        if (pending.rows.some((row) => row.n === n)) {
          await setForcedRow(context.db, pending.id, n, intent === 'forcer')
        }
        return redirect(`${previewUrl}?voir=archives`, 303)
      }
      if (intent !== 'confirmer') return redirect(previewUrl, 303)

      try {
        const done = await context.db.transaction(async (tx) => {
          // Locked: a second click waits, then finds nothing (one import, written once).
          const locked = await findImport(tx, pending.id, actor.id, { lock: true })
          if (locked === null) throw new Refused(404, '')
          const plan = await planOf(tx, actor, locked, location)
          if (!plan.confirmable) {
            throw new Refused(400, 'Des lignes sont à corriger : rien n’a été importé.')
          }
          if (signatureOf(plan) !== formValue(context.formData, 'plan')) {
            throw new Refused(
              409,
              'L’inventaire a changé depuis cet aperçu : vérifiez-le à nouveau, puis importez.',
            )
          }
          return writePlan(tx, actor, locked, location, plan)
        })
        const parts = [
          `${count(done.created)} ${done.created > 1 ? 'objets ajoutés' : 'objet ajouté'}`,
          ...(done.updated > 0 ? [`${count(done.updated)} mis à jour`] : []),
        ]
        context.session.flash('notice', `Import terminé : ${parts.join(', ')}.`)
        return redirect(landingHref(location), 303)
      } catch (error) {
        if (error instanceof Refused) {
          if (error.status === 404) return importNotFound(context)
          return render(context, loaded, { error: error.message, status: error.status })
        }
        // Another import or the form took a reference meanwhile: nothing was written.
        if (isRefConflict(error)) {
          return render(context, loaded, {
            error:
              'Une référence du fichier vient d’être prise par un autre objet : rien n’a été importé. Vérifiez à nouveau.',
            status: 409,
          })
        }
        throw error
      }
    },
  },
})
