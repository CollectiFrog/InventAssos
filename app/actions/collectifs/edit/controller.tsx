import * as f from 'remix/data-schema/form-data'
import { getCsrfToken } from 'remix/middleware/csrf'
import { redirect } from 'remix/response/redirect'
import { createController } from 'remix/router'

import { logAction } from '../../../data/audit-log.ts'
import { findActiveCollectifBySlug, updateCollectifProfile } from '../../../data/collectifs.ts'
import { canEditCollectif } from '../../../permissions.ts'
import { routes } from '../../../routes.ts'
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
  city: f.field(requiredText(120)),
  description: f.field(optionalText(2000)),
  contactPhone: f.field(optionalPhone()),
})

/** Edit a collectif's city, description and contact phone (US-0.3.5, US-0.7.12). */
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
      if (!parsed.ok) {
        return context.render(
          <EditCollectifPage
            viewer={viewerOf(context)}
            csrfToken={getCsrfToken(context)}
            collectif={collectif}
            values={{
              city: formValue(formData, 'city'),
              description: formValue(formData, 'description'),
              contactPhone: formValue(formData, 'contactPhone'),
            }}
            errors={parsed.errors}
          />,
          { status: 400 },
        )
      }

      await db.transaction(async (tx) => {
        await updateCollectifProfile(tx, collectif.id, {
          city: parsed.value.city,
          description: parsed.value.description ?? '',
          contactPhone: parsed.value.contactPhone,
        })
        await logAction(tx, {
          actorId: actor.id,
          action: 'collectif.updated',
          entity: 'collectif',
          entityId: collectif.id,
        })
      })
      session.flash('notice', 'Présentation enregistrée.')
      return redirect(routes.collectifs.show.href({ slug: collectif.slug }), 303)
    },
  },
})
