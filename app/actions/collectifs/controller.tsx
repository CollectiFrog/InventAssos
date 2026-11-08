import * as f from 'remix/data-schema/form-data'
import { getCsrfToken } from 'remix/middleware/csrf'
import { redirect } from 'remix/response/redirect'
import { createController } from 'remix/router'

import {
  createCollectifRequest,
  findCollectifHoldingSlug,
  listCollectifs,
  listPendingRequestsBy,
  slugify,
} from '../../data/collectifs.ts'
import { sendSafely } from '../../mail/mailer.ts'
import { newCollectifRequestMail } from '../../mail/messages.ts'
import { canRequestCollectif, isValidatedUser } from '../../permissions.ts'
import { routes } from '../../routes.ts'
import {
  formValue,
  optionalPhone,
  optionalText,
  parseForm,
  requiredText,
} from '../../validation.ts'
import { forbidden, requireUser } from '../guards.tsx'
import { viewerOf } from '../viewer.ts'
import { CollectifsPage, RequestCollectifPage } from './collectifs-pages.tsx'

const requestSchema = f.object({
  name: f.field(requiredText(120).refine((name) => slugify(name) !== '', 'Nom invalide.')),
  description: f.field(optionalText(2000)),
  contactPhone: f.field(optionalPhone()),
})

/** List of collectifs. */
export const collectifsController = createController(routes.collectifs, {
  actions: {
    async index(context) {
      const actor = requireUser(context)
      if (actor instanceof Response) return actor
      if (!isValidatedUser(actor)) return forbidden(context)

      const notice = context.session.get('notice')
      return context.render(
        <CollectifsPage
          viewer={viewerOf(context)}
          active={await listCollectifs(context.db, 'active')}
          myRequests={await listPendingRequestsBy(context.db, actor.id)}
          notice={typeof notice === 'string' ? notice : undefined}
        />,
      )
    },
  },
})

/** Request a new collectif (US-0.3.1). */
export const requestCollectifController = createController(routes.collectifs.request, {
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

      await createCollectifRequest(db, {
        name: parsed.value.name,
        description: parsed.value.description ?? '',
        contactPhone: parsed.value.contactPhone,
        requestedBy: actor.id,
      })
      const admins = [...settings.adminEmails]
      if (admins.length > 0) {
        const reviewUrl = settings.appUrl + routes.admin.accounts.href()
        await sendSafely(mailer, newCollectifRequestMail(admins, reviewUrl))
      }
      context.session.flash('notice', 'Demande envoyée : un administrateur va l’examiner.')
      return redirect(routes.collectifs.index.href(), 303)
    },
  },
})
