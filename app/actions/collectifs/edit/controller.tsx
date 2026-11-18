import * as f from 'remix/data-schema/form-data'
import { getCsrfToken } from 'remix/middleware/csrf'
import { redirect } from 'remix/response/redirect'
import { createController } from 'remix/router'

import { logAction } from '../../../data/audit-log.ts'
import {
  findActiveCollectifBySlug,
  findCollectifHoldingSlug,
  slugify,
  updateCollectifProfile,
} from '../../../data/collectifs.ts'
import { canEditCollectif } from '../../../permissions.ts'
import { routes } from '../../../routes.ts'
import type { FieldErrors } from '../../../ui/form.tsx'
import {
  formValue,
  optionalPhone,
  optionalText,
  parseForm,
  requiredText,
} from '../../../validation.ts'
import { forbidden, notFound, requireUser } from '../../guards.tsx'
import { viewerOf } from '../../viewer.ts'
import { EditCollectifPage } from './edit-page.tsx'

const profileSchema = f.object({
  name: f.field(requiredText(120).refine((name) => slugify(name) !== '', 'Nom invalide.')),
  city: f.field(requiredText(120)),
  description: f.field(optionalText(2000)),
  contactPhone: f.field(optionalPhone()),
})

/** Edit a collectif's name, city, description and contact phone (US-0.3.5, US-0.10.14). */
export default createController(routes.collectifs.edit, {
  actions: {
    async index(context) {
      const actor = requireUser(context)
      if (actor instanceof Response) return actor
      const collectif = await findActiveCollectifBySlug(context.db, context.params.slug)
      if (collectif === null) return notFound(context)
      if (!canEditCollectif(actor, collectif.id)) return forbidden(context)

      return context.render(
        <EditCollectifPage
          viewer={viewerOf(context)}
          csrfToken={getCsrfToken(context)}
          collectif={collectif}
          values={{
            name: collectif.name,
            city: collectif.city,
            description: collectif.description,
            contactPhone: collectif.contact_phone ?? '',
          }}
        />,
      )
    },

    async action(context) {
      const actor = requireUser(context)
      if (actor instanceof Response) return actor
      const { db, formData, session } = context
      const collectif = await findActiveCollectifBySlug(db, context.params.slug)
      if (collectif === null) return notFound(context)
      if (!canEditCollectif(actor, collectif.id)) return forbidden(context)

      const parsed = parseForm(profileSchema, formData)
      // Two names with the same slug are the same collectif: another one may not hold it.
      const holder = parsed.ok
        ? await findCollectifHoldingSlug(db, slugify(parsed.value.name))
        : null
      const taken = holder !== null && holder.id !== collectif.id
      if (!parsed.ok || taken) {
        const errors: FieldErrors = parsed.ok ? {} : parsed.errors
        if (taken) errors.name = 'Un autre collectif porte déjà ce nom.'
        return context.render(
          <EditCollectifPage
            viewer={viewerOf(context)}
            csrfToken={getCsrfToken(context)}
            collectif={collectif}
            values={{
              name: formValue(formData, 'name'),
              city: formValue(formData, 'city'),
              description: formValue(formData, 'description'),
              contactPhone: formValue(formData, 'contactPhone'),
            }}
            errors={errors}
          />,
          { status: 400 },
        )
      }

      const renamed = parsed.value.name !== collectif.name
      const updated = await db.transaction(async (tx) => {
        const row = await updateCollectifProfile(tx, collectif.id, {
          name: parsed.value.name,
          city: parsed.value.city,
          description: parsed.value.description ?? '',
          contactPhone: parsed.value.contactPhone,
        })
        await logAction(tx, {
          actorId: actor.id,
          action: renamed ? 'collectif.renamed' : 'collectif.updated',
          entity: 'collectif',
          entityId: collectif.id,
        })
        return row
      })
      session.flash('notice', 'Présentation enregistrée.')
      return redirect(routes.collectifs.show.href({ slug: updated.slug }), 303)
    },
  },
})
