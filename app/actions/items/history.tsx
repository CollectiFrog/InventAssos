import type { Handle } from 'remix/component'

import type { HistoryEntry } from '../../data/audit-log.ts'
import { archiveReasonLabels } from '../../ui/labels.ts'

const dateFormat = new Intl.DateTimeFormat('fr-FR', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Europe/Paris',
})

const fieldLabels: Record<string, string> = {
  name: 'nom',
  category_id: 'catégorie',
  quantity: 'quantité',
  brand: 'marque',
  model: 'modèle',
  serial_number: 'numéro de série',
  condition: 'état',
  estimated_value: 'valeur',
  description: 'description',
}

/**
 * What the item page shows (US-0.5.6). An allow-list: other item actions in the log, such as
 * `item.contacted`, say who talks to whom and stay out of the page.
 */
export const itemHistoryActions = [
  'item.created',
  'item.updated',
  'item.moved',
  'item.archived',
] as const

function place(name: string | null | undefined): string {
  return name ? `« ${name} »` : 'un lieu supprimé'
}

/** French sentence for one history line. */
export function describe(entry: HistoryEntry): string {
  const p = entry.payload
  switch (entry.action) {
    case 'item.created':
      return `Ajouté dans ${place(entry.locationNames.locationId)}`
    case 'item.updated': {
      const fields = String(p.fields ?? '')
        .split(',')
        .filter(Boolean)
        .map((field) => fieldLabels[field] ?? field)
      return `Modifié (${fields.join(', ')})`
    }
    case 'item.moved':
      return `Déplacé de ${place(entry.locationNames.fromLocationId)} vers ${place(entry.locationNames.toLocationId)}`
    case 'item.archived': {
      const reason = archiveReasonLabels[p.reason as keyof typeof archiveReasonLabels]
      return `Archivé${reason ? ` (${reason.toLowerCase()})` : ''}`
    }
    default:
      return entry.action
  }
}

/** The history of an item, oldest first (US-0.5.6). */
export function ItemHistory(handle: Handle<{ entries: HistoryEntry[] }>) {
  return () => (
    <section>
      <h2>Historique</h2>
      {handle.props.entries.length === 0 ? (
        <p>Aucun événement enregistré.</p>
      ) : (
        <ol class="history">
          {handle.props.entries.map((entry, index) => (
            <li key={String(index)}>
              <time datetime={entry.at.toISOString()}>{dateFormat.format(entry.at)}</time> —{' '}
              {describe(entry)}
              <span class="status"> par {entry.actorName ?? 'un compte supprimé'}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
