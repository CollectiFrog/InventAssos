import { getCsrfToken } from 'remix/middleware/csrf'
import { redirect } from 'remix/response/redirect'
import { createController } from 'remix/router'

import { logAction } from '../../../data/audit-log.ts'
import { createItem, type ItemOwner, listCategories } from '../../../data/items.ts'
import { createLocation, findLocationById, type LocationOwner } from '../../../data/locations.ts'
import { findUserByEmail, normalizeEmail } from '../../../data/users.ts'
import type { CurrentUser } from '../../../middleware/current-user.ts'
import type { AppContext } from '../../../middleware/index.ts'
import { canDepositForPerson, canStoreItemsIn, isValidatedUser } from '../../../permissions.ts'
import { routes } from '../../../routes.ts'
import type { FieldErrors } from '../../../ui/form.tsx'
import { formValue, parseForm } from '../../../validation.ts'
import { forbidden, requireUser } from '../../guards.tsx'
import { ownerOptionsFor, parseOwner } from '../../locations/owners.ts'
import { viewerOf } from '../../viewer.ts'
import { ownerOptions, parseItemOwner, storableLocations } from '../choices.ts'
import { AddItemPage, type AddItemPageProps } from '../items-pages.tsx'
import {
  itemFieldNames,
  itemFieldsSchema,
  newLocationChoice,
  newLocationSchema,
} from '../schema.ts'

/** Fields of the add form besides the item's own (owner, location, new location). */
const placeFieldNames = [
  'owner',
  'locationId',
  'ownerEmail',
  'newLocationOwner',
  'newLocationName',
  'newLocationCity',
] as const

async function renderForm(
  context: AppContext,
  actor: CurrentUser,
  values: AddItemPageProps['values'],
  errors?: FieldErrors,
) {
  const { db } = context
  const categories = (await listCategories(db)).map((c) => ({ value: c.id, label: c.name }))
  const existing = await storableLocations(db, actor)
  // US-0.7.4: without any location yet, the form starts on « Un nouveau lieu ».
  const locationId =
    existing.length === 0 && !values.locationId ? newLocationChoice : values.locationId
  return context.render(
    <AddItemPage
      viewer={viewerOf(context)}
      csrfToken={getCsrfToken(context)}
      values={{ ...values, locationId }}
      errors={errors}
      categories={categories}
      locations={[...existing, { value: newLocationChoice, label: 'Un nouveau lieu (à décrire)' }]}
      locationOwners={await ownerOptionsFor(db, actor)}
      owners={await ownerOptions(db, actor)}
    />,
    { status: errors ? 400 : 200 },
  )
}

/** Add an item to a location the actor manages, or to a new one (US-0.5.1, US-0.7.4). */
export default createController(routes.items.create, {
  actions: {
    async index(context) {
      const actor = requireUser(context)
      if (actor instanceof Response) return actor
      if (!isValidatedUser(actor)) return forbidden(context)

      const locationId = context.url.searchParams.get('lieu') ?? ''
      // « Ajouter du matériel » on a collectif's page preselects it as owner (US-0.7.5).
      const asked = context.url.searchParams.get('pour') ?? ''
      const owner = parseItemOwner(asked, actor) ? asked : 'me'
      const empty = Object.fromEntries(itemFieldNames.map((name) => [name, '']))
      return renderForm(context, actor, {
        ...(empty as AddItemPageProps['values']),
        quantity: '1',
        categoryId: 'other',
        owner,
        ownerEmail: '',
        locationId,
        newLocationOwner: 'me',
        newLocationName: '',
        newLocationCity: '',
      })
    },

    async action(context) {
      const actor = requireUser(context)
      if (actor instanceof Response) return actor
      if (!isValidatedUser(actor)) return forbidden(context)

      const { db, formData, session } = context
      const errors: FieldErrors = {}
      // Where the item goes: an existing location, or a new one described in the form.
      let location: { id: string | null; collectif_id: string | null; user_id: string | null }
      let newLocation: { owner: LocationOwner; name: string; city: string } | null = null
      if (formValue(formData, 'locationId') === newLocationChoice) {
        // The new location's owner follows the location rules: me, or a collectif I manage.
        const owner = parseOwner(formValue(formData, 'newLocationOwner'), actor)
        if (owner === null) return forbidden(context)
        location = {
          id: null,
          collectif_id: 'collectifId' in owner ? owner.collectifId : null,
          user_id: 'userId' in owner ? owner.userId : null,
        }
        const described = parseForm(newLocationSchema, formData)
        if (described.ok) {
          const { newLocationName: name, newLocationCity: city } = described.value
          newLocation = { owner, name, city }
        } else Object.assign(errors, described.errors)
      } else {
        // To put an item in a location you must manage it (ADR 0009): refused, not ignored.
        const existing = await findLocationById(db, formValue(formData, 'locationId'))
        if (existing === null || !canStoreItemsIn(actor, existing)) return forbidden(context)
        location = existing
      }
      const ownerChoice = formValue(formData, 'owner')
      let owner: ItemOwner | null = null
      if (ownerChoice === 'person') {
        // US-0.5.2: only into a collectif's location the actor manages, for a validated account.
        if (!canDepositForPerson(actor, location)) return forbidden(context)
        const person = await findUserByEmail(db, normalizeEmail(formValue(formData, 'ownerEmail')))
        if (person?.status === 'active') owner = { userId: person.id }
        else errors.ownerEmail = 'Aucun compte validé avec cette adresse.'
      } else {
        owner = parseItemOwner(ownerChoice, actor)
        if (owner === null) return forbidden(context)
      }

      const parsed = parseForm(itemFieldsSchema, formData)
      const categoryIds = new Set((await listCategories(db)).map((c) => c.id))
      if (!parsed.ok) Object.assign(errors, parsed.errors)
      if (parsed.ok && !categoryIds.has(parsed.value.categoryId)) {
        errors.categoryId = 'Catégorie inconnue.'
      }
      if (!parsed.ok || owner === null || Object.keys(errors).length > 0) {
        const values = Object.fromEntries(
          [...itemFieldNames, ...placeFieldNames].map((n) => [n, formValue(formData, n)]),
        )
        return renderForm(context, actor, values as AddItemPageProps['values'], errors)
      }

      const item = await db.transaction(async (tx) => {
        let locationId = location.id
        if (newLocation !== null) {
          const { owner: placeOwner, name, city } = newLocation
          const place = await createLocation(tx, placeOwner, {
            name,
            city,
            address: null,
            notes: null,
          })
          await logAction(tx, {
            actorId: actor.id,
            action: 'location.created',
            entity: 'location',
            entityId: place.id,
            payload:
              'collectifId' in placeOwner
                ? { collectifId: placeOwner.collectifId }
                : { userId: placeOwner.userId },
          })
          locationId = place.id
        }
        if (locationId === null) throw new Error('No location for the new item')
        const created = await createItem(tx, {
          fields: parsed.value,
          locationId,
          owner,
          createdBy: actor.id,
        })
        await logAction(tx, {
          actorId: actor.id,
          action: 'item.created',
          entity: 'item',
          entityId: created.id,
          payload: { locationId },
        })
        return created
      })
      session.flash('notice', `« ${item.name} » ajouté.`)
      return redirect(routes.items.show.href({ itemId: item.id }), 303)
    },
  },
})
