import * as f from 'remix/data-schema/form-data'
import { getCsrfToken } from 'remix/middleware/csrf'
import { redirect } from 'remix/response/redirect'
import { createController } from 'remix/router'

import {
  createCollectifRequest,
  findActiveCollectifBySlug,
  findCollectifHoldingSlug,
  listCollectifs,
  listPendingRequestsBy,
  slugify,
} from '../../data/collectifs.ts'
import { findResponsible, listActiveResponsibles, setResponsible } from '../../data/responsibles.ts'
import { sendSafely } from '../../mail/mailer.ts'
import { newCollectifRequestMail, newResponsibleRequestMail } from '../../mail/messages.ts'
import {
  canEditCollectif,
  canManageResponsibles,
  canRequestCollectif,
  canRequestResponsibility,
  isValidatedUser,
} from '../../permissions.ts'
import { routes } from '../../routes.ts'
import {
  formValue,
  optionalPhone,
  optionalText,
  parseForm,
  requiredText,
} from '../../validation.ts'
import { forbidden, notFound, requireUser } from '../guards.tsx'
import { viewerOf } from '../viewer.ts'
import { CollectifPage, type Membership } from './collectif-page.tsx'
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

    async show(context) {
      const actor = requireUser(context)
      if (actor instanceof Response) return actor
      if (!isValidatedUser(actor)) return forbidden(context)

      const { db } = context
      const collectif = await findActiveCollectifBySlug(db, context.params.slug)
      if (collectif === null) return notFound(context)

      const link = await findResponsible(db, actor.id, collectif.id)
      const membership: Membership =
        link?.status === 'active' ? 'responsible' : link?.status === 'pending' ? 'pending' : 'none'
      const notice = context.session.get('notice')
      return context.render(
        <CollectifPage
          viewer={viewerOf(context)}
          csrfToken={getCsrfToken(context)}
          collectif={collectif}
          responsibles={await listActiveResponsibles(db, collectif.id)}
          canManageResponsibles={canManageResponsibles(actor)}
          membership={membership}
          canEdit={canEditCollectif(actor, collectif.id)}
          notice={typeof notice === 'string' ? notice : undefined}
        />,
      )
    },

    // US-0.3.3: one open request per person and collectif; a rejected or removed person may ask again.
    async requestResponsibility(context) {
      const actor = requireUser(context)
      if (actor instanceof Response) return actor

      const { db, mailer, settings, session } = context
      const collectif = await findActiveCollectifBySlug(db, context.params.slug)
      if (collectif === null) return notFound(context)
      if (!canRequestResponsibility(actor, collectif.id)) return forbidden(context)

      const showUrl = routes.collectifs.show.href({ slug: collectif.slug })
      const existing = await findResponsible(db, actor.id, collectif.id)
      if (existing?.status === 'pending') {
        session.flash('notice', 'Vous avez déjà une demande en cours pour ce collectif.')
        return redirect(showUrl, 303)
      }

      await setResponsible(db, { userId: actor.id, collectifId: collectif.id, status: 'pending' })
      const admins = [...settings.adminEmails]
      if (admins.length > 0) {
        const reviewUrl = settings.appUrl + routes.admin.index.href()
        await sendSafely(mailer, newResponsibleRequestMail(admins, reviewUrl))
      }
      session.flash('notice', 'Demande envoyée : un administrateur va l’examiner.')
      return redirect(showUrl, 303)
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
        const reviewUrl = settings.appUrl + routes.admin.index.href()
        await sendSafely(mailer, newCollectifRequestMail(admins, reviewUrl))
      }
      context.session.flash('notice', 'Demande envoyée : un administrateur va l’examiner.')
      return redirect(routes.collectifs.index.href(), 303)
    },
  },
})
