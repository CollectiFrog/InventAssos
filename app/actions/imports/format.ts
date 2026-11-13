// The inventory file format, shared by the export (US-0.10.4) and the import (US-0.10.1): an
// export can be edited in a spreadsheet and imported back (ADR 0026).
import type { Item } from '../../data/tables.ts'
import { conditionLabels } from '../../ui/labels.ts'

/** The fields a column of the file can hold, in the order of the export. */
export const inventoryFields = [
  'ref',
  'name',
  'category',
  'quantity',
  'brand',
  'model',
  'serialNumber',
  'condition',
  'estimatedValue',
  'description',
  'location',
  'id',
] as const
export type InventoryField = (typeof inventoryFields)[number]

/** A stored column mapping, each entry a known field or null: what the database holds is checked. */
export function toColumnMapping(raw: readonly (string | null)[]): (InventoryField | null)[] {
  return raw.map((field) =>
    field !== null && (inventoryFields as readonly string[]).includes(field)
      ? (field as InventoryField)
      : null,
  )
}

/** Column titles of the export, also the names the import recognises first. */
export const inventoryHeaders: Record<InventoryField, string> = {
  ref: 'Référence',
  name: 'Nom',
  category: 'Catégorie',
  quantity: 'Quantité',
  brand: 'Marque',
  model: 'Modèle',
  serialNumber: 'Numéro de série',
  condition: 'État',
  estimatedValue: 'Valeur estimée (€)',
  description: 'Description',
  location: 'Lieu',
  id: 'Identifiant',
}

/** The header row of the export and of the empty model file. */
export function inventoryHeaderRow(): string[] {
  return inventoryFields.map((field) => inventoryHeaders[field])
}

/** "150,50": comma, two decimals, no thousands separator, as a French spreadsheet reads it. */
export function formatValueCell(value: Item['estimated_value']): string {
  if (value === null || value === undefined) return ''
  return Number(value).toFixed(2).replace('.', ',')
}

/** What one exported row needs: the item and the names of its category and location. */
export interface ExportedItem {
  item: Item
  categoryName: string
  /** The location's name only: never its city, address or notes (ADR 0010). */
  locationName: string
}

/** One row of the export, in `inventoryFields` order. */
export function inventoryRow({ item, categoryName, locationName }: ExportedItem): string[] {
  const cells: Record<InventoryField, string> = {
    ref: item.ref ?? '',
    name: item.name,
    category: categoryName,
    quantity: String(item.quantity),
    brand: item.brand ?? '',
    model: item.model ?? '',
    serialNumber: item.serial_number ?? '',
    condition: item.condition ? conditionLabels[item.condition] : '',
    estimatedValue: formatValueCell(item.estimated_value),
    description: item.description ?? '',
    location: locationName,
    id: item.id,
  }
  return inventoryFields.map((field) => cells[field])
}
