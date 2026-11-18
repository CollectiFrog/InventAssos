// An equipment state as icon, word and colour (guidelines 4.3): never colour alone.
import type { Handle } from 'remix/component'

import type { ItemCondition } from '../data/tables.ts'
import { Icon, type IconName } from './icons.tsx'

/** The states the interface can show; `lent` and `reserved` wait for loans (V1.3) and bookings (V1.4). */
export type ItemStatus = 'available' | 'lent' | 'broken' | 'reserved' | 'archived'

const looks: Record<ItemStatus, { icon: IconName; label: string }> = {
  available: { icon: 'available', label: 'Disponible' },
  lent: { icon: 'lent', label: 'Prêté' },
  broken: { icon: 'broken', label: 'En réparation' },
  reserved: { icon: 'reserved', label: 'Réservé' },
  archived: { icon: 'archive', label: 'Archivé' },
}

/**
 * The state worth showing for an item today: archived, or under repair or out of order from its
 * condition. Null otherwise: without loans the app cannot say an item is available.
 */
export function itemStatusOf(item: {
  archivedAt: Date | null
  condition: ItemCondition | null
}): ItemStatus | null {
  if (item.archivedAt) return 'archived'
  if (item.condition === 'repair' || item.condition === 'broken') return 'broken'
  return null
}

/** A small tinted badge; `label` replaces the default word (« Hors service »). */
export function StatusBadge(handle: Handle<{ status: ItemStatus; label?: string }>) {
  return () => {
    const { status, label } = handle.props
    const look = looks[status]
    return (
      <span class={`status-badge status-${status}`}>
        <Icon name={look.icon} size={12} />
        {label ?? look.label}
      </span>
    )
  }
}
