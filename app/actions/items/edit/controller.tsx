import type { Handle } from 'remix/component'
import { getCsrfToken } from 'remix/middleware/csrf'
import { redirect } from 'remix/response/redirect'
import { createController } from 'remix/router'

import { logAction } from '../../../data/audit-log.ts'
import { listCategories } from '../../../data/categories.ts'
import {
  findItemById,
  findItemDetails,
  type ItemDetails,
  updateItemFields,
} from '../../../data/items.ts'
import type { AppContext } from '../../../middleware/index.ts'
import { canChangeItem, canSeeItem } from '../../../permissions.ts'
import { routes } from '../../../routes.ts'
import { CsrfField, ErrorSummary, type FieldErrors } from '../../../ui/form.tsx'
import { Layout, type Viewer } from '../../../ui/layout.tsx'
import { formValue, parseForm } from '../../../validation.ts'
import { forbidden, notFound, requireUser } from '../../guards.tsx'
import { viewerOf } from '../../viewer.ts'
import { ItemFields } from '../item-fields.tsx'
import { type ItemFormValues, itemFieldNames, itemFieldsSchema } from '../schema.ts'

/** Edit form of an item (US-0.5.3). */
function EditItemPage(
  handle: Handle<{
    viewer: Viewer
    csrfToken: string
    item: ItemDetails
    values: ItemFormValues
    errors?: FieldErrors
    categories: { value: string; label: string }[]
  }>,
) {
  return () => {
    const { viewer, csrfToken, item, values, errors = {}, categories } = handle.props
    return (
      <Layout title={`Modifier ${item.name}`} viewer={viewer}>
        <h1>Modifier « {item.name} »</h1>
        <ErrorSummary errors={errors} />
        <form
          method="post"
          action={routes.items.edit.action.href({ itemId: item.id })}
          class="stack form-wide"
        >
          <CsrfField token={csrfToken} />
          <ItemFields values={values} errors={errors} categories={categories} />
          <div class="actions">
            <button type="submit">Enregistrer</button>
            <a class="button secondary" href={routes.items.show.href({ itemId: item.id })}>
              Annuler
            </a>
          </div>
        </form>
      </Layout>
    )
  }
}

function valuesOf(item: ItemDetails): ItemFormValues {
  return {
    name: item.name,
    categoryId: item.category_id,
    quantity: String(item.quantity),
    brand: item.brand ?? '',
    model: item.model ?? '',
    serialNumber: item.serial_number ?? '',
    condition: item.condition ?? '',
    estimatedValue:
      item.estimated_value === null ? '' : String(item.estimated_value).replace('.', ','),
    description: item.description ?? '',
  }
}

async function render(
  context: AppContext,
  item: ItemDetails,
  values: ItemFormValues,
  errors?: FieldErrors,
) {
  const categories = (await listCategories(context.db)).map((c) => ({ value: c.id, label: c.name }))
  return context.render(
    <EditItemPage
      viewer={viewerOf(context)}
      csrfToken={getCsrfToken(context)}
      item={item}
      values={values}
      errors={errors}
      categories={categories}
    />,
    { status: errors ? 400 : 200 },
  )
}

/** Edit an item: its owner or the manager of its location (US-0.5.3). */
export default createController(routes.items.edit, {
  actions: {
    async index(context) {
      const actor = requireUser(context)
      if (actor instanceof Response) return actor
      const item = await findItemDetails(context.db, context.params.itemId)
      if (item === null || item.archived_at || !canSeeItem(actor, item)) return notFound(context)
      if (!canChangeItem(actor, item)) return forbidden(context)
      return render(context, item, valuesOf(item))
    },

    async action(context) {
      const actor = requireUser(context)
      if (actor instanceof Response) return actor
      const { db, formData, session } = context
      const item = await findItemDetails(db, context.params.itemId)
      if (item === null || item.archived_at || !canSeeItem(actor, item)) return notFound(context)
      if (!canChangeItem(actor, item)) return forbidden(context)

      const parsed = parseForm(itemFieldsSchema, formData)
      const categoryIds = new Set((await listCategories(db)).map((c) => c.id))
      const errors: FieldErrors = parsed.ok ? {} : { ...parsed.errors }
      if (parsed.ok && !categoryIds.has(parsed.value.categoryId)) {
        errors.categoryId = 'Catégorie inconnue.'
      }
      if (!parsed.ok || Object.keys(errors).length > 0) {
        const values = Object.fromEntries(itemFieldNames.map((n) => [n, formValue(formData, n)]))
        return render(context, item, values as ItemFormValues, errors)
      }

      await db.transaction(async (tx) => {
        const current = await findItemById(tx, item.id)
        if (current === null) return
        const changed = await updateItemFields(tx, current, parsed.value)
        if (changed.length === 0) return
        // Field names only: the values may be free text typed by a person (ADR 0010).
        await logAction(tx, {
          actorId: actor.id,
          action: 'item.updated',
          entity: 'item',
          entityId: item.id,
          payload: { fields: changed.join(',') },
        })
      })
      session.flash('notice', 'Modifications enregistrées.')
      return redirect(routes.items.show.href({ itemId: item.id }), 303)
    },
  },
})
