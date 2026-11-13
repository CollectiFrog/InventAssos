import { getCsrfToken } from 'remix/middleware/csrf'
import { redirect } from 'remix/response/redirect'
import { createController } from 'remix/router'

import { logAction } from '../../../data/audit-log.ts'
import {
  categoryNameTaken,
  createCategory,
  deleteCategory,
  findCategory,
  listCategories,
  moveCategory,
  renameCategory,
} from '../../../data/categories.ts'
import { countItemsByCategory, recategorizeItems } from '../../../data/items.ts'
import type { AppContext } from '../../../middleware/index.ts'
import { canManageCategories } from '../../../permissions.ts'
import { routes } from '../../../routes.ts'
import type { FieldErrors } from '../../../ui/form.tsx'
import { formValue } from '../../../validation.ts'
import { forbidden, notFound, requireUser } from '../../guards.tsx'
import { viewerOf } from '../../viewer.ts'
import { CategoriesPage } from './categories-page.tsx'

const listUrl = routes.admin.categories.index.href()

/** The page, with what was typed and its errors after a refused change. */
async function renderPage(
  context: AppContext,
  form?: { values: Record<string, string>; errors: FieldErrors },
) {
  const notice = context.session.get('notice')
  return context.render(
    <CategoriesPage
      viewer={viewerOf(context)}
      csrfToken={getCsrfToken(context)}
      categories={await listCategories(context.db)}
      usage={await countItemsByCategory(context.db)}
      values={form?.values ?? {}}
      errors={form?.errors ?? {}}
      notice={typeof notice === 'string' ? notice : undefined}
    />,
    { status: form ? 400 : 200 },
  )
}

/** A French name: required, at most 60 characters, not used by another category. */
async function checkName(
  context: AppContext,
  name: string,
  exceptId = '',
): Promise<string | undefined> {
  if (name === '') return 'Ce champ est obligatoire.'
  if (name.length > 60) return '60 caractères au plus.'
  if (await categoryNameTaken(context.db, name, exceptId)) {
    return 'Une catégorie porte déjà ce nom.'
  }
  return undefined
}

/** Categories managed by admins (US-0.7.10); every change is logged, IDs only. */
export default createController(routes.admin.categories, {
  actions: {
    async index(context) {
      const actor = requireUser(context)
      if (actor instanceof Response) return actor
      if (!canManageCategories(actor)) return forbidden(context)
      return renderPage(context)
    },

    async create(context) {
      const actor = requireUser(context)
      if (actor instanceof Response) return actor
      if (!canManageCategories(actor)) return forbidden(context)

      const name = formValue(context.formData, 'name').trim()
      const error = await checkName(context, name)
      if (error) return renderPage(context, { values: { name }, errors: { name: error } })

      await context.db.transaction(async (tx) => {
        const category = await createCategory(tx, name)
        await logAction(tx, {
          actorId: actor.id,
          action: 'category.created',
          entity: 'category',
          entityId: category.id,
        })
      })
      context.session.flash('notice', `Catégorie « ${name} » ajoutée.`)
      return redirect(listUrl, 303)
    },

    async rename(context) {
      const actor = requireUser(context)
      if (actor instanceof Response) return actor
      if (!canManageCategories(actor)) return forbidden(context)
      const category = await findCategory(context.db, context.params.categoryId)
      if (category === null) return notFound(context)

      const name = formValue(context.formData, 'name').trim()
      const field = `name-${category.id}`
      const error = await checkName(context, name, category.id)
      if (error)
        return renderPage(context, { values: { [field]: name }, errors: { [field]: error } })

      await context.db.transaction(async (tx) => {
        await renameCategory(tx, category.id, name)
        await logAction(tx, {
          actorId: actor.id,
          action: 'category.renamed',
          entity: 'category',
          entityId: category.id,
        })
      })
      context.session.flash('notice', `« ${category.name} » renommée en « ${name} ».`)
      return redirect(listUrl, 303)
    },

    up: (context) => move(context, context.params.categoryId, -1),
    down: (context) => move(context, context.params.categoryId, 1),

    // US-0.7.10: a used category is deleted only after its items move to another one.
    async remove(context) {
      const actor = requireUser(context)
      if (actor instanceof Response) return actor
      if (!canManageCategories(actor)) return forbidden(context)
      const { db } = context
      const category = await findCategory(db, context.params.categoryId)
      if (category === null) return notFound(context)

      const used = (await countItemsByCategory(db)).get(category.id) ?? 0
      const targetId = formValue(context.formData, 'moveTo')
      const target = used > 0 ? await findCategory(db, targetId) : null
      if (used > 0 && (target === null || target.id === category.id)) {
        const field = `moveTo-${category.id}`
        return renderPage(context, {
          values: {},
          errors: { [field]: 'Choisissez la catégorie qui reçoit son matériel.' },
        })
      }

      await db.transaction(async (tx) => {
        if (target !== null) {
          for (const itemId of await recategorizeItems(tx, category.id, target.id)) {
            await logAction(tx, {
              actorId: actor.id,
              action: 'item.updated',
              entity: 'item',
              entityId: itemId,
              payload: { fields: 'category_id' },
            })
          }
        }
        await deleteCategory(tx, category.id)
        await logAction(tx, {
          actorId: actor.id,
          action: 'category.deleted',
          entity: 'category',
          entityId: category.id,
          payload: target ? { movedTo: target.id } : {},
        })
      })
      context.session.flash(
        'notice',
        target
          ? `« ${category.name} » supprimée ; son matériel est maintenant dans « ${target.name} ».`
          : `« ${category.name} » supprimée.`,
      )
      return redirect(listUrl, 303)
    },
  },
})

/** Moves a category one place up or down, logged with its direction. */
async function move(context: AppContext, categoryId: string, direction: -1 | 1) {
  const actor = requireUser(context)
  if (actor instanceof Response) return actor
  if (!canManageCategories(actor)) return forbidden(context)
  const category = await findCategory(context.db, categoryId)
  if (category === null) return notFound(context)

  const moved = await context.db.transaction(async (tx) => {
    if (await moveCategory(tx, category.id, direction)) {
      await logAction(tx, {
        actorId: actor.id,
        action: 'category.moved',
        entity: 'category',
        entityId: category.id,
        payload: { direction: direction < 0 ? 'up' : 'down' },
      })
      return true
    }
    return false
  })
  if (moved) {
    const where = direction < 0 ? 'monte' : 'descend'
    context.session.flash('notice', `« ${category.name} » ${where} d’une place.`)
  }
  return redirect(`${listUrl}#categorie-${category.id}`, 303)
}
