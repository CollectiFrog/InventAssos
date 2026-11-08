// French labels for values stored in English in the database.
import type { ArchiveReason, ItemCondition } from '../data/tables.ts'

/** How an item's condition reads in the interface. */
export const conditionLabels: Record<ItemCondition, string> = {
  new: 'Neuf',
  good: 'Bon état',
  worn: 'Usé',
  repair: 'À réparer',
  broken: 'Hors service',
}

/** Why an item was archived, as shown in the interface. */
export const archiveReasonLabels: Record<ArchiveReason, string> = {
  sold: 'Vendu',
  lost: 'Perdu',
  broken: 'Cassé',
  other: 'Autre raison',
}

const euros = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' })

/** "1 234,50 €". */
export function formatEuros(value: number | string): string {
  return euros.format(Number(value))
}
