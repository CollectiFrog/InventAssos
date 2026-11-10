import * as f from 'remix/data-schema/form-data'
import { getCsrfToken } from 'remix/middleware/csrf'
import { redirect } from 'remix/response/redirect'
import { createController } from 'remix/router'

import {
  createCollectifRequest,
  findCollectifHoldingSlug,
  slugify,
} from '../../../data/collectifs.ts'
import { newCollectifRequestMail } from '../../../mail/messages.ts'
import { canRequestCollectif } from '../../../permissions.ts'
import { hitUserRequest, notifyAdmins } from '../../../rate-limits.ts'
import { routes } from '../../../routes.ts'
import {
  formValue,
  optionalPhone,
  optionalText,
  parseForm,
  requiredText,
} from '../../../validation.ts'
import { forbidden, requireUser, tooManyRequests } from '../../guards.tsx'
import { viewerOf } from '../../viewer.ts'
import { RequestCollectifPage } from '../collectifs-pages.tsx'

const requestSchema = f.object({
  name: f.field(requiredText(120).refine((name) => slugify(name) !== '', 'Nom invalide.')),
  description: f.field(optionalText(2000)),
  contactPhone: f.field(optionalPhone()),
})
/** Request a new collectif (US-0.3.1). */
export default createController(routes.collectifs.request, {
  actions: {
    index(context) {
      const actor = requireUser(context)
      if (actor instanceof Response) return actor
      if (!canRequestCollectif(actor)) return forbidden(context)

      return context.render(
        <RequestCollectifPage viewer={viewerOf(context)} csrfToken={getCsrfToken(context)} />,
      )
    },

    async action(context) {
      const actor = requireUser(context)
      if (actor instanceof Response) return actor
      if (!canRequestCollectif(actor)) return forbidden(context)

      const { db, mailer, settings, formData } = context
      const parsed = parseForm(requestSchema, formData)
      const errors = parsed.ok ? {} : parsed.errors
      if (parsed.ok && (await findCollectifHoldingSlug(db, slugify(parsed.value.name)))) {
        errors.name = 'Un collectif porte déjà ce nom (ou un nom très proche).'
      }
      if (!parsed.ok || errors.name) {
        return context.render(
          <RequestCollectifPage
            viewer={viewerOf(context)}
            csrfToken={getCsrfToken(context)}
            values={{
              name: formValue(formData, 'name'),
              description: formValue(formData, 'description'),
              contactPhone: formValue(formData, 'contactPhone'),
            }}
            errors={errors}
          />,
          { status: 400 },
        )
      }

      const limit = await hitUserRequest(db, settings, actor.id)
      if (!limit.allowed) return tooManyRequests(context, limit.retryAfterSeconds)

      await createCollectifRequest(db, {
        name: parsed.value.name,
        description: parsed.value.description ?? '',
        contactPhone: parsed.value.contactPhone,
        requestedBy: actor.id,
      })
      const reviewUrl = settings.appUrl + routes.admin.index.href()
      await notifyAdmins(db, mailer, settings, 'collectif', (admins) =>
        newCollectifRequestMail(admins, reviewUrl),
      )
      context.session.flash('notice', 'Demande envoyée : un administrateur va l’examiner.')
      return redirect(routes.collectifs.index.href(), 303)
    },
  },
})
