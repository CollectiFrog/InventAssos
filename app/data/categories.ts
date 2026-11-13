// Data access for categories: the only module that reads or writes `categories` (US-0.7.10).
import { type Database, sql } from 'remix/data-table'

import { slugify } from './collectifs.ts'
import { type Category, categories } from './tables.ts'

/** The categories, in display order. */
export async function listCategories(db: Database): Promise<Category[]> {
  return db.findMany(categories, { orderBy: ['position', 'asc'] })
}

/** A category by its key, or null. */
export async function findCategory(db: Database, id: string): Promise<Category | null> {
  return id ? db.find(categories, id) : null
}

/** True when another category already has this name, ignoring case and accents. */
export async function categoryNameTaken(
  db: Database,
  name: string,
  exceptId = '',
): Promise<boolean> {
  const result = await db.exec(sql`
    select 1 from categories
    where inv_fold(trim(name)) = inv_fold(trim(${name})) and id <> ${exceptId}
    limit 1
  `)
  return (result.rows?.length ?? 0) > 0
}

/** Adds a category at the end of the list; its key comes from the name and never changes. */
export async function createCategory(db: Database, name: string): Promise<Category> {
  const base = slugify(name) || 'categorie'
  let id = base
  for (let n = 2; await findCategory(db, id); n++) id = `${base}-${n}`
  const last = await db.exec(sql`select coalesce(max(position), 0) as p from categories`)
  const position = Number(last.rows?.[0]?.p ?? 0) + 1
  return db.create(categories, { id, name, parent_id: null, position }, { returnRow: true })
}

/** Changes a category's French name; its key stays. */
export async function renameCategory(db: Database, id: string, name: string): Promise<void> {
  await db.update(categories, id, { name })
}

/** Swaps a category with its neighbour above (-1) or below (+1); false at either end. */
export async function moveCategory(db: Database, id: string, direction: -1 | 1): Promise<boolean> {
  const list = await listCategories(db)
  const index = list.findIndex((category) => category.id === id)
  const current = list[index]
  const other = list[index + direction]
  if (current === undefined || other === undefined) return false
  await db.update(categories, current.id, { position: other.position })
  await db.update(categories, other.id, { position: current.position })
  return true
}

/** Deletes a category; the database refuses while an item, archived or not, still uses it. */
export async function deleteCategory(db: Database, id: string): Promise<void> {
  await db.delete(categories, id)
}
