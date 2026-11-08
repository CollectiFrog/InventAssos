import { getCsrfToken } from 'remix/middleware/csrf'
import { redirect } from 'remix/response/redirect'
import { createController } from 'remix/router'

import { logAction } from '../../../data/audit-log.ts'
import { createItem, listCategories } from '../../../data/items.ts'
import { findLocationById } from '../../../data/locations.ts'
import type { CurrentUser } from '../../../middleware/current-user.ts'
import type { AppContext } from '../../../middleware/index.ts'
import { canStoreItemsIn, isValidatedUser } from '../../../permissions.ts'
import { routes } from '../../../routes.ts'
import type { FieldErrors } from '../../../ui/form.tsx'
import { formValue, parseForm } from '../../../validation.ts'
import { forbidden, requireUser } from '../../guards.tsx'
import { viewerOf } from '../../viewer.ts'
import { ownerOptions, parseItemOwner, storableLocations } from '../choices.ts'
import { AddItemPage, type AddItemPageProps } from '../items-pages.tsx'
import { itemFieldNames, itemFieldsSchema } from '../schema.ts'

async function renderForm(
  context: AppContext,
  actor: CurrentUser,
  values: AddItemPageProps['values'],
  errors?: FieldErrors,
) {
  const { db } = context
  const categories = (await listCategories(db)).map((c) => ({ value: c.id, label: c.name }))
  return context.render(
    <AddItemPage
      viewer={viewerOf(context)}
      csrfToken={getCsrfToken(context)}
      values={values}
      errors={errors}
      categories={categories}
      locations={await storableLocations(db, actor)}
      owners={await ownerOptions(db, actor)}
    />,
    { status: errors ? 400 : 200 },
  )
}

/** Add an item to a location the actor manages (US-0.5.1). */
export default createController(routes.items.create, {
  actions: {
    async index(context) {
      const actor = requireUser(context)
      if (actor instanceof Response) return actor
      if (!isValidatedUser(actor)) return forbidden(context)

      const locationId = context.url.searchParams.get('lieu') ?? ''
      const empty = Object.fromEntries(itemFieldNames.map((name) => [name, '']))
      return renderForm(context, actor, {
        ...(empty as AddItemPageProps['values']),
        quantity: '1',
        categoryId: 'other',
        owner: 'me',
        locationId,
      })
    },

    async action(context) {
      const actor = requireUser(context)
      if (actor instanceof Response) return actor
      if (!isValidatedUser(actor)) return forbidden(context)

      const { db, formData, session } = context
      // To put an item in a location you must manage it (ADR 0009): refused, not ignored.
      const location = await findLocationById(db, formValue(formData, 'locationId'))
      if (location === null || !canStoreItemsIn(actor, location)) return forbidden(context)
      const owner = parseItemOwner(formValue(formData, 'owner'), actor)
      if (owner === null) return forbidden(context)

      const parsed = parseForm(itemFieldsSchema, formData)
      const categoryIds = new Set((await listCategories(db)).map((c) => c.id))
      const errors: FieldErrors = parsed.ok ? {} : { ...parsed.errors }
      if (parsed.ok && !categoryIds.has(parsed.value.categoryId)) {
        errors.categoryId = 'Catégorie inconnue.'
      }
      if (!parsed.ok || Object.keys(errors).length > 0) {
        const values = Object.fromEntries(
          [...itemFieldNames, 'owner', 'locationId'].map((n) => [n, formValue(formData, n)]),
        )
        return renderForm(context, actor, values as AddItemPageProps['values'], errors)
      }

      const item = await db.transaction(async (tx) => {
        const created = await createItem(tx, {
          fields: parsed.value,
          locationId: location.id,
          owner,
          createdBy: actor.id,
        })
        await logAction(tx, {
          actorId: actor.id,
          action: 'item.created',
          entity: 'item',
          entityId: created.id,
          payload: { locationId: location.id },
        })
        return created
      })
      session.flash('notice', `« ${item.name} » ajouté.`)
      return redirect(routes.items.show.href({ itemId: item.id }), 303)
    },
  },
})
