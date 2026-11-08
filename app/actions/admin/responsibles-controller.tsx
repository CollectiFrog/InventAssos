import { redirect } from 'remix/response/redirect'
import { createController } from 'remix/router'

import { logAction } from '../../data/audit-log.ts'
import { findCollectifById } from '../../data/collectifs.ts'
import { findResponsible, setResponsible } from '../../data/responsibles.ts'
import { findUserById } from '../../data/users.ts'
import { sendSafely } from '../../mail/mailer.ts'
import { responsibleApprovedMail, responsibleRejectedMail } from '../../mail/messages.ts'
import { canManageResponsibles } from '../../permissions.ts'
import { routes } from '../../routes.ts'
import { forbidden, requireUser } from '../guards.tsx'

const queueUrl = routes.admin.accounts.href()

/** Accept or reject a request to become responsible (US-0.3.4). */
export default createController(routes.admin.responsibles, {
  actions: {
    async approve(context) {
      const actor = requireUser(context)
      if (actor instanceof Response) return actor
      if (!canManageResponsibles(actor)) return forbidden(context)

      const { db, mailer, settings, session, params } = context
      const request = await findResponsible(db, params.userId, params.collectifId)
      const user = await findUserById(db, params.userId)
      const collectif = await findCollectifById(db, params.collectifId)
      if (
        request?.status !== 'pending' ||
        user?.status !== 'active' ||
        collectif?.status !== 'active'
      ) {
        session.flash('notice', 'Cette demande a déjà été traitée.')
        return redirect(queueUrl, 303)
      }

      await db.transaction(async (tx) => {
        await setResponsible(tx, {
          userId: user.id,
          collectifId: collectif.id,
          status: 'active',
          validatedBy: actor.id,
        })
        await logAction(tx, {
          actorId: actor.id,
          action: 'responsible.approved',
          entity: 'collectif',
          entityId: collectif.id,
          payload: { userId: user.id },
        })
      })
      await sendSafely(mailer, responsibleApprovedMail(user.email, collectif.name, settings.appUrl))
      session.flash('notice', `${user.name} est responsable de « ${collectif.name} ».`)
      return redirect(queueUrl, 303)
    },

    async reject(context) {
      const actor = requireUser(context)
      if (actor instanceof Response) return actor
      if (!canManageResponsibles(actor)) return forbidden(context)

      const { db, mailer, session, params } = context
      const request = await findResponsible(db, params.userId, params.collectifId)
      const user = await findUserById(db, params.userId)
      const collectif = await findCollectifById(db, params.collectifId)
      if (request?.status !== 'pending' || user === null || collectif === null) {
        session.flash('notice', 'Cette demande a déjà été traitée.')
        return redirect(queueUrl, 303)
      }

      await db.transaction(async (tx) => {
        await setResponsible(tx, {
          userId: user.id,
          collectifId: collectif.id,
          status: 'rejected',
          validatedBy: actor.id,
        })
        await logAction(tx, {
          actorId: actor.id,
          action: 'responsible.rejected',
          entity: 'collectif',
          entityId: collectif.id,
          payload: { userId: user.id },
        })
      })
      await sendSafely(mailer, responsibleRejectedMail(user.email, collectif.name))
      session.flash('notice', `Demande de ${user.name} refusée.`)
      return redirect(queueUrl, 303)
    },
  },
})
