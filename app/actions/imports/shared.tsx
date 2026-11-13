import type { Handle, RemixNode } from 'remix/component'
import type { Database } from 'remix/data-table'

import { findImport, type PendingImport } from '../../data/imports.ts'
import {
  findLocationWithOwner,
  type LocationWithOwner,
  listAllLocations,
  listLocationsOwnedBy,
} from '../../data/locations.ts'
import type { Location } from '../../data/tables.ts'
import type { CurrentUser } from '../../middleware/current-user.ts'
import type { AppContext } from '../../middleware/index.ts'
import { canImportInto, isValidatedUser } from '../../permissions.ts'
import { routes } from '../../routes.ts'
import { Layout, type Viewer } from '../../ui/layout.tsx'
import { type Step, Steps } from '../../ui/steps.tsx'
import { forbidden, requireUser } from '../guards.tsx'
import { viewerOf } from '../viewer.ts'

/** A location with its owner's name, and the collectif's slug when a collectif owns it. */
export type ImportLocation = Location & { ownerName: string; ownerSlug: string | null }

/** The locations the actor may import into (US-0.10.1, US-0.10.5), by name. */
export async function importableLocations(
  db: Database,
  actor: CurrentUser,
): Promise<LocationWithOwner[]> {
  const candidates = actor.isAdmin
    ? await listAllLocations(db)
    : await listLocationsOwnedBy(db, actor.id, [...actor.managedCollectifIds])
  return candidates.filter((location) => canImportInto(actor, location))
}

/** Where an import leads back to: the collectif's page, or « Mon matériel ». */
export function landingHref(location: { ownerSlug: string | null }): string {
  return location.ownerSlug
    ? routes.collectifs.show.href({ slug: location.ownerSlug })
    : routes.items.index.href()
}

/** « 15 h 42 », in Paris. */
const timeFormat = new Intl.DateTimeFormat('fr-FR', {
  hour: 'numeric',
  minute: '2-digit',
  timeZone: 'Europe/Paris',
})

/** « 15 h 42 », as French pages write a time. */
export function frenchTime(date: Date): string {
  return timeFormat.format(date).replace(':', ' h ')
}

/** The same 404 for an expired, finished, replaced, unknown or someone else's import. */
function ImportNotFoundPage(handle: Handle<{ viewer: Viewer }>) {
  return () => (
    <Layout title="Import introuvable" viewer={handle.props.viewer}>
      <h1>Import introuvable</h1>
      <p>
        Cet import n’existe plus : un fichier est gardé une heure, et il a peut-être été terminé ou
        remplacé par un autre.
      </p>
      <p>
        <a class="button" href={routes.imports.start.index.href()}>
          Recommencer un import
        </a>
      </p>
    </Layout>
  )
}

/** The 404 of the import pages. */
export function importNotFound(context: AppContext): Response | Promise<Response> {
  return context.render(<ImportNotFoundPage viewer={viewerOf(context)} />, { status: 404 })
}

/**
 * Loads the author's import with its location, or the answer to send instead: 404 when it is not
 * theirs or not alive, 403 when they may no longer import there (a role lost within the hour).
 */
export async function loadImport(
  context: AppContext,
  importId: string,
  options: { lock?: boolean } = {},
): Promise<{ actor: CurrentUser; pending: PendingImport; location: ImportLocation } | Response> {
  const actor = requireUser(context)
  if (actor instanceof Response) return actor
  if (!isValidatedUser(actor)) return forbidden(context)
  const pending = await findImport(context.db, importId, actor.id, options)
  if (pending === null) return importNotFound(context)
  const location = await findLocationWithOwner(context.db, pending.locationId)
  if (location === null) return importNotFound(context)
  if (!canImportInto(actor, location)) return forbidden(context)
  return { actor, pending, location }
}

/** The steps of the import, the current one marked; earlier ones link back once they exist. */
export function importSteps(current: 1 | 2 | 3 | 4, importId?: string): Step[] {
  const state = (step: number): Step['state'] =>
    step < current ? 'done' : step === current ? 'current' : 'todo'
  return [
    { label: 'Fichier', href: routes.imports.start.index.href(), state: state(1) },
    {
      label: 'Colonnes',
      href: importId ? routes.imports.columns.index.href({ importId }) : undefined,
      state: state(2),
    },
    {
      label: 'Catégories, états et lieux',
      href: importId ? routes.imports.values.index.href({ importId }) : undefined,
      state: state(3),
    },
    {
      label: 'Vérification',
      href: importId ? routes.imports.preview.index.href({ importId }) : undefined,
      state: state(4),
    },
  ]
}

/** The import's page shell: its section, breadcrumb and steps. */
export function ImportLayout(
  handle: Handle<{
    viewer: Viewer
    title: string
    location?: { ownerName: string; ownerSlug: string | null } | null
    steps: Step[]
    children?: RemixNode
  }>,
) {
  return () => {
    const { viewer, title, location, steps, children } = handle.props
    const forCollectif = location?.ownerSlug
    return (
      <Layout
        title={title}
        viewer={viewer}
        section={forCollectif ? 'collectifs' : 'mine'}
        trail={
          forCollectif && location
            ? [
                { label: 'Collectifs', href: routes.collectifs.index.href() },
                {
                  label: location.ownerName,
                  href: routes.collectifs.show.href({ slug: forCollectif }),
                },
                { label: 'Importer' },
              ]
            : [{ label: 'Mon matériel', href: routes.items.index.href() }, { label: 'Importer' }]
        }
      >
        <h1>Importer un fichier</h1>
        <Steps label="Étapes de l’import" steps={steps} />
        {children}
      </Layout>
    )
  }
}
