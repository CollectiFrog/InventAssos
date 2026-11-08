import { getCsrfToken } from 'remix/middleware/csrf'
import { redirect } from 'remix/response/redirect'
import { createController } from 'remix/router'

import {
  findActiveCollectifBySlug,
  listCollectifs,
  listPendingRequestsBy,
} from '../../data/collectifs.ts'
import { listCollectifLocations } from '../../data/locations.ts'
import { findResponsible, listActiveResponsibles, setResponsible } from '../../data/responsibles.ts'
import { sendSafely } from '../../mail/mailer.ts'
import { newResponsibleRequestMail } from '../../mail/messages.ts'
import {
  canEditCollectif,
  canManageCollectifLocations,
  canManageResponsibles,
  canRequestResponsibility,
  isValidatedUser,
} from '../../permissions.ts'
import { routes } from '../../routes.ts'
import { forbidden, notFound, requireUser } from '../guards.tsx'
import { viewerOf } from '../viewer.ts'
import { CollectifPage, type Membership } from './collectif-page.tsx'
import { CollectifsPage } from './collectifs-pages.tsx'

/** List of collectifs. */
export default createController(routes.collectifs, {
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
          locations={await listCollectifLocations(db, collectif.id)}
          canManageLocations={canManageCollectifLocations(actor, collectif.id)}
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
