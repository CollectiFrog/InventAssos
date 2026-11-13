// What an import will do, row by row (US-0.10.1 to US-0.10.3, ADR 0026, ADR 0027). Pure: the page
// shows the plan, and the confirmation recomputes it inside its transaction, so the preview and
// the result always agree.
import type { ItemFields } from '../../data/items.ts'
import { type ItemCondition, itemConditions } from '../../data/tables.ts'
import { parseForm } from '../../validation.ts'
import { itemFieldsSchema } from '../items/schema.ts'
import { fold } from './fold.ts'
import { type InventoryField, inventoryHeaders } from './format.ts'
import { parseEuros, parseQuantity } from './parse.ts'
import { type CategoryChoice, guessCategory, guessCondition, guessLocation } from './values.ts'

/** The rows of an uploaded file, each with its spreadsheet row number. */
export interface ImportRows {
  header: readonly string[]
  rows: readonly { n: number; cells: readonly string[] }[]
}

/** The field chosen for each column of the file, or null for « Ne pas importer ». */
export type ColumnMapping = readonly (InventoryField | null)[]

/**
 * What each distinct value of the category, condition and location columns stands for, keyed by
 * its folded text. A value missing from the mapping is guessed, as on the page that shows them.
 */
export interface ValueMapping {
  category: Readonly<Record<string, string>>
  /** A condition key, or '' for « Non précisé ». */
  condition: Readonly<Record<string, string>>
  /** A location ID, or '' for « the import's location ». */
  location: Readonly<Record<string, string>>
}

/** An item of the owner the file may update, as the plan needs it. */
export interface ExistingItem {
  id: string
  ref: string | null
  name: string
  categoryId: string
  quantity: number
  brand: string | null
  model: string | null
  serialNumber: string | null
  condition: ItemCondition | null
  /** As the database returns it: « 150.50 », or null. */
  estimatedValue: string | number | null
  description: string | null
  locationId: string
  locationName: string
  archived: boolean
  /** Whether the person importing may change it (`canChangeItem`). */
  changeable: boolean
}

/** What the database says about the file, loaded once per request. */
export interface ImportWorld {
  /** Where rows without a location go; one of `locations`. */
  defaultLocation: { id: string; name: string }
  /** The owner's locations the import may store items in. */
  locations: readonly { id: string; name: string }[]
  categories: readonly CategoryChoice[]
  /**
   * Each reference of the file (as typed, NFC), with the key the database compares it by
   * (`inv_fold`) and the owner's item that holds it, archived or not.
   */
  refs: ReadonlyMap<string, { key: string; item: ExistingItem | null }>
  /** The owner's items named by the « Identifiant » column, archived or not (ADR 0027). */
  itemsById: ReadonlyMap<string, ExistingItem>
  /** Folded names of the active items in each location, for the « already there » warning. */
  namesByLocation: ReadonlyMap<string, ReadonlySet<string>>
  /** Whether the person importing may give items references (`canSetItemRef`). */
  maySetRef: boolean
}

/** What happens to a row. `archived` rows are skipped unless the person forces them (ADR 0027). */
export type RowState = 'create' | 'update' | 'unchanged' | 'archived' | 'invalid'

/** One row of the plan. */
export interface PlannedRow {
  n: number
  state: RowState
  errors: string[]
  warnings: string[]
  /** What the row shows: its reference, name, category, quantity and target location. */
  ref: string
  name: string
  categoryName: string
  quantity: string
  locationName: string
  /** The fields to write: all of them on creation, the merged ones on update. */
  fields: ItemFields | null
  /** The item updated, or the archived item a forced row stands beside. */
  itemId: string | null
  /** Item columns that change, for the history (`item.updated`). */
  changed: string[]
  /** Where the item goes: on creation always, on update only when it moves. */
  locationId: string | null
  /** The location it leaves, when an update moves it. */
  fromLocationId: string | null
}

/** Counts shown first on the preview. */
export interface PlanCounts {
  create: number
  update: number
  moved: number
  unchanged: number
  archived: number
  invalid: number
  warnings: number
}

/** The whole plan. */
export interface ImportPlan {
  rows: PlannedRow[]
  counts: PlanCounts
  /** True when nothing blocks and there is something to write. */
  confirmable: boolean
}

/** French names of the fields, for messages: « Marque : 120 caractères au maximum. ». */
const fieldLabels: Record<keyof ItemFields, string> = {
  name: inventoryHeaders.name,
  categoryId: inventoryHeaders.category,
  quantity: inventoryHeaders.quantity,
  brand: inventoryHeaders.brand,
  model: inventoryHeaders.model,
  serialNumber: inventoryHeaders.serialNumber,
  ref: inventoryHeaders.ref,
  condition: inventoryHeaders.condition,
  estimatedValue: 'Valeur',
  description: inventoryHeaders.description,
}

/** Database column of each field, for the history of an update. */
const fieldColumns: Record<keyof ItemFields, string> = {
  name: 'name',
  categoryId: 'category_id',
  quantity: 'quantity',
  brand: 'brand',
  model: 'model',
  serialNumber: 'serial_number',
  ref: 'ref',
  condition: 'condition',
  estimatedValue: 'estimated_value',
  description: 'description',
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * A reference as it is stored and looked up: one line (runs of spaces, tabs and no-break spaces
 * become one space), trimmed, NFC. The loader and the plan both use it, so a reference is never
 * looked up under another key than the one it was loaded with.
 */
export function normaliseRef(cell: string): string {
  return cell.replace(/\s+/g, ' ').trim().normalize('NFC')
}

/** « 3, 4, 5 et 1 996 autres »: other row numbers, the list cut short. */
function rowList(numbers: readonly number[]): string {
  const shown = numbers.slice(0, 5).join(', ')
  const rest = numbers.length - 5
  return rest > 0 ? `${shown} et ${rest.toLocaleString('fr-FR')} autres` : shown
}

/** Runs of spaces and line breaks become one space, except in the description. */
function oneLine(cell: string): string {
  return cell.replace(/\s+/g, ' ').trim()
}

/** The value of a field as the item form would hold it. */
function formValueOf(item: ExistingItem): Record<keyof ItemFields, string> {
  return {
    name: item.name,
    categoryId: item.categoryId,
    quantity: String(item.quantity),
    brand: item.brand ?? '',
    model: item.model ?? '',
    serialNumber: item.serialNumber ?? '',
    ref: item.ref ?? '',
    condition: item.condition ?? '',
    estimatedValue: item.estimatedValue === null ? '' : String(item.estimatedValue),
    description: item.description ?? '',
  }
}

/** Same value, as the history compares it. */
function sameValue(field: keyof ItemFields, before: ExistingItem, after: ItemFields): boolean {
  const old = formValueOf(before)[field]
  const next = after[field]
  if (field === 'estimatedValue') {
    return (old === '' ? null : Number(old)) === (next === null ? null : Number(next))
  }
  return old === (next === null ? '' : String(next))
}

/**
 * Plans the import of every row.
 *
 * Locations: a created item goes to the location its cell names (as mapped on the values step),
 * else to the import's. An updated item moves only when its cell names another of the owner's
 * locations; a value left on « the import's location », or unknown, never moves it.
 *
 * `forced` holds the row numbers the person chose to add although their reference is an archived
 * item's: they become new items, without that reference.
 */
export function planImport(
  file: ImportRows,
  columns: ColumnMapping,
  values: ValueMapping,
  world: ImportWorld,
  forced: ReadonlySet<number> = new Set(),
): ImportPlan {
  const columnOf = new Map<InventoryField, number>()
  columns.forEach((field, index) => {
    if (field !== null && !columnOf.has(field)) columnOf.set(field, index)
  })
  const cellOf = (cells: readonly string[], field: InventoryField): string | null => {
    const index = columnOf.get(field)
    if (index === undefined) return null
    return field === 'description' ? (cells[index] ?? '').trim() : oneLine(cells[index] ?? '')
  }
  const categoryName = new Map(world.categories.map((c) => [c.id, c.name]))
  const locationName = new Map(world.locations.map((l) => [l.id, l.name]))

  // Rows sharing a reference, or aimed at the same item (by Identifiant or by reference): each is
  // told the others' numbers, so no item is written twice by one file.
  const byRefKey = new Map<string, number[]>()
  const byItem = new Map<string, number[]>()
  for (const { n, cells } of file.rows) {
    const ref = cellOf(cells, 'ref')
    const entry = ref ? world.refs.get(normaliseRef(ref)) : undefined
    if (entry?.key) byRefKey.set(entry.key, [...(byRefKey.get(entry.key) ?? []), n])
    const id = cellOf(cells, 'id')?.toLowerCase() ?? ''
    const target = id !== '' ? world.itemsById.get(id)?.id : entry?.item?.id
    if (target) byItem.set(target, [...(byItem.get(target) ?? []), n])
  }
  const others = (map: Map<string, number[]>, key: string | undefined, n: number) =>
    key === undefined ? [] : (map.get(key) ?? []).filter((other) => other !== n)

  // Same name twice in one location, both without reference: a warning on each.
  const createdNames = new Map<string, number>()

  const rows = file.rows.map(({ n, cells }): PlannedRow => {
    const errors: string[] = []
    const warnings: string[] = []
    const row: PlannedRow = {
      n,
      state: 'invalid',
      errors,
      warnings,
      ref: '',
      name: '',
      categoryName: '',
      quantity: '',
      locationName: '',
      fields: null,
      itemId: null,
      changed: [],
      locationId: null,
      fromLocationId: null,
    }

    if (cells.slice(file.header.length).some((cell) => cell.trim() !== '')) {
      errors.push('Cette ligne a plus de cellules que la ligne de titres : un séparateur en trop ?')
    }

    // Which item the row is about: its Identifiant first (ADR 0027), else its reference.
    const refCell = cellOf(cells, 'ref')
    const ref = refCell ? normaliseRef(refCell) : ''
    row.ref = ref
    const refEntry = ref ? world.refs.get(ref) : undefined
    const idCell = cellOf(cells, 'id') ?? ''
    let item: ExistingItem | null = null
    if (idCell !== '') {
      const found = uuidPattern.test(idCell) ? world.itemsById.get(idCell.toLowerCase()) : undefined
      if (found === undefined) {
        // Not an item of this owner: nothing else of the row means anything.
        errors.push('Identifiant inconnu pour ce propriétaire.')
        row.name = cellOf(cells, 'name') ?? ''
        return row
      }
      item = found
      if (item && refEntry?.item && refEntry.item.id !== item.id) {
        errors.push(`La référence « ${ref} » est déjà celle d’un autre objet.`)
      }
    } else if (refEntry?.item) item = refEntry.item
    if (ref !== '') {
      const twins = others(byRefKey, refEntry?.key, n)
      if (twins.length > 0) {
        errors.push(
          `Référence « ${ref} » en double dans le fichier (aussi ligne ${rowList(twins)}).`,
        )
      }
    }
    if (item) {
      const refTwins = new Set(others(byRefKey, refEntry?.key, n))
      const twins = others(byItem, item.id, n).filter((other) => !refTwins.has(other))
      if (twins.length > 0) {
        errors.push(`Cet objet est aussi visé ligne ${rowList(twins)} : une seule ligne par objet.`)
      }
    }

    // A row about an archived item is set aside, unless the person adds it as a new item.
    const archivedTwin = item?.archived ? item : null
    if (archivedTwin && !forced.has(n)) {
      row.state = errors.length > 0 ? 'invalid' : 'archived'
      row.itemId = archivedTwin.id
      row.name = cellOf(cells, 'name') || archivedTwin.name
      row.locationName = archivedTwin.locationName
      return row
    }
    if (archivedTwin) {
      warnings.push(
        `Ajouté comme nouvel objet, sans référence : « ${archivedTwin.name} » garde la sienne.`,
      )
      item = null
    }
    if (item && !item.changeable) errors.push('Vous ne pouvez pas modifier cet objet.')
    // A reference lives in its owner's namespace: only the owner sets it (US-0.10.3).
    const setsRef = item
      ? idCell !== '' && ref !== '' && ref !== item.ref
      : ref !== '' && !archivedTwin
    if (setsRef && !world.maySetRef) {
      errors.push('Référence : seul le propriétaire de l’objet choisit sa référence.')
    }

    // The fields as the item form would receive them: the existing values, then the cells.
    const base: Record<keyof ItemFields, string> = item
      ? formValueOf(item)
      : {
          name: '',
          categoryId: '',
          quantity: '1',
          brand: '',
          model: '',
          serialNumber: '',
          ref: archivedTwin ? '' : ref,
          condition: '',
          estimatedValue: '',
          description: '',
        }
    const set = (field: keyof ItemFields, value: string) => {
      base[field] = value
    }
    for (const [field, target] of [
      ['name', 'name'],
      ['brand', 'brand'],
      ['model', 'model'],
      ['serialNumber', 'serialNumber'],
      ['description', 'description'],
    ] as const) {
      const cell = cellOf(cells, field)
      if (cell) set(target, cell)
    }
    // An Identifiant row may give its item a reference; found by its reference, the item keeps
    // the one stored (« amp-01 » in the file does not rewrite « AMP-01 »); blank keeps it too.
    if (item && idCell !== '' && ref !== '') set('ref', ref)

    const quantityCell = cellOf(cells, 'quantity') ?? ''
    const quantity = parseQuantity(quantityCell)
    if (quantity === null) {
      errors.push(`Quantité « ${quantityCell} » : indiquez un nombre entier de 1 à 999 999.`)
    } else if (!quantity.blank) set('quantity', String(quantity.value))

    const valueCell = cellOf(cells, 'estimatedValue') ?? ''
    const value = parseEuros(valueCell)
    if (value === null) {
      errors.push(`Valeur « ${valueCell} » : montant non reconnu (exemple : 1 250,50).`)
    } else if (!value.blank) set('estimatedValue', String(value.value))

    const categoryCell = cellOf(cells, 'category') ?? ''
    if (categoryCell !== '' || !item) {
      const chosen = values.category[fold(categoryCell)]
      const categoryId =
        chosen !== undefined && categoryName.has(chosen)
          ? chosen
          : guessCategory(categoryCell, world.categories)?.categoryId
      if (categoryId === undefined)
        errors.push('Aucune catégorie n’existe : demandez à un administrateur.')
      else set('categoryId', categoryId)
    }

    const conditionCell = cellOf(cells, 'condition') ?? ''
    if (conditionCell !== '') {
      const chosen = values.condition[fold(conditionCell)]
      const condition =
        chosen !== undefined
          ? (itemConditions as readonly string[]).includes(chosen)
            ? chosen
            : ''
          : (guessCondition(conditionCell).condition ?? '')
      // « Non précisé » on an update keeps what the item says.
      if (condition !== '' || !item) set('condition', condition)
    }

    // Where it goes: the location named in the file, else the import's (« ici »).
    const locationCell = cellOf(cells, 'location') ?? ''
    let target: string | null = null
    if (locationCell !== '') {
      const chosen = values.location[fold(locationCell)]
      target =
        chosen !== undefined
          ? chosen !== '' && locationName.has(chosen)
            ? chosen
            : null
          : guessLocation(locationCell, world.locations).locationId
    }

    const parsed = parseForm(itemFieldsSchema, new URLSearchParams(base))
    if (!parsed.ok) {
      for (const [field, message] of Object.entries(parsed.errors)) {
        const label = fieldLabels[field as keyof ItemFields] ?? field
        errors.push(
          field === 'name' && base.name === '' ? 'Nom manquant.' : `${label} : ${message}`,
        )
      }
    }
    const fields = parsed.ok ? parsed.value : null
    row.name = fields?.name ?? base.name
    row.categoryName = categoryName.get(base.categoryId) ?? ''
    row.quantity = base.quantity

    if (item) {
      row.itemId = item.id
      const moving =
        target !== null &&
        target !== item.locationId &&
        fold(locationCell) !== fold(item.locationName)
      row.locationName = moving ? (locationName.get(target ?? '') ?? '') : item.locationName
      if (errors.length > 0 || fields === null) return row
      row.fields = fields
      row.changed = (Object.keys(fieldColumns) as (keyof ItemFields)[])
        .filter((field) => !sameValue(field, item, fields))
        .map((field) => fieldColumns[field])
      if (moving) {
        row.locationId = target
        row.fromLocationId = item.locationId
      }
      row.state = row.changed.length > 0 || moving ? 'update' : 'unchanged'
      return row
    }

    const locationId = target ?? world.defaultLocation.id
    row.locationId = locationId
    row.locationName = locationName.get(locationId) ?? world.defaultLocation.name
    if (errors.length > 0 || fields === null) return row
    row.fields = fields
    row.state = 'create'
    const nameKey = fold(fields.name)
    if (world.namesByLocation.get(locationId)?.has(nameKey)) {
      warnings.push(
        `Un objet « ${fields.name} » existe déjà dans ce lieu : il sera ajouté en plus.`,
      )
    }
    if (fields.ref === null) {
      const twin = createdNames.get(`${locationId} ${nameKey}`)
      if (twin !== undefined) warnings.push(`Même nom que la ligne ${twin}.`)
      else createdNames.set(`${locationId} ${nameKey}`, n)
    }
    return row
  })

  const counts: PlanCounts = {
    create: 0,
    update: 0,
    moved: 0,
    unchanged: 0,
    archived: 0,
    invalid: 0,
    warnings: 0,
  }
  for (const row of rows) {
    counts[row.state]++
    if (row.state === 'update' && row.fromLocationId !== null) counts.moved++
    if (row.warnings.length > 0) counts.warnings++
  }
  return {
    rows,
    counts,
    confirmable: counts.invalid === 0 && counts.create + counts.update > 0,
  }
}
