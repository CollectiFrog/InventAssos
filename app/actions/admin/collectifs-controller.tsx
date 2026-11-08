import * as f from 'remix/data-schema/form-data'
import { redirect } from 'remix/response/redirect'
import { createController } from 'remix/router'

import { logAction } from '../../data/audit-log.ts'
import { decideCollectif, findCollectifById } from '../../data/collectifs.ts'
import { setResponsible } from '../../data/responsibles.ts'
import { findUserById } from '../../data/users.ts'
import { sendSafely } from '../../mail/mailer.ts'
import { collectifApprovedMail, collectifRejectedMail } from '../../mail/messages.ts'
import { canReviewCollectifs } from '../../permissions.ts'
import { routes } from '../../routes.ts'
import { optionalText, parseForm } from '../../validation.ts'
import { forbidden, requireUser } from '../guards.tsx'

const rejectSchema = f.object({ reason: f.field(optionalText(500)) })
const queueUrl = routes.admin.index.href()

/** Accept or reject a collectif request (US-0.3.2). */
export default createController(routes.admin.collectifs, {
  actions: {
    async approve(context) {
      const actor = requireUser(context)
      if (actor instanceof Response) return actor
      if (!canReviewCollectifs(actor)) return forbidden(context)

      const { db, mailer, settings, session } = context
      const collectif = await findCollectifById(db, context.params.collectifId)
      const requester = collectif?.requested_by
        ? await findUserById(db, collectif.requested_by)
        : null
      if (collectif === null || collectif.status !== 'pending') {
        session.flash('notice', 'Cette demande a déjà été traitée.')
        return redirect(queueUrl, 303)
      }
      // An active collectif must keep a responsible: without an active requester, reject instead.
      if (requester === null || requester.status !== 'active') {
        session.flash('notice', 'Le demandeur n’a plus de compte actif : refusez cette demande.')
        return redirect(queueUrl, 303)
      }

      await db.transaction(async (tx) => {
        await decideCollectif(tx, collectif.id, { status: 'active', adminId: actor.id })
        await setResponsible(tx, {
          userId: requester.id,
          collectifId: collectif.id,
          status: 'active',
          validatedBy: actor.id,
        })
        await logAction(tx, {
          actorId: actor.id,
          action: 'collectif.approved',
          entity: 'collectif',
          entityId: collectif.id,
          payload: { responsibleId: requester.id },
        })
      })
      await sendSafely(
        mailer,
        collectifApprovedMail(requester.email, collectif.name, settings.appUrl),
      )
      session.flash('notice', `Collectif « ${collectif.name} » accepté.`)
      return redirect(queueUrl, 303)
    },

    async reject(context) {
      const actor = requireUser(context)
      if (actor instanceof Response) return actor
      if (!canReviewCollectifs(actor)) return forbidden(context)

      const { db, mailer, session } = context
      const parsed = parseForm(rejectSchema, context.formData)
      const reason = parsed.ok ? parsed.value.reason : null
      const collectif = await findCollectifById(db, context.params.collectifId)
      if (collectif === null || collectif.status !== 'pending') {
        session.flash('notice', 'Cette demande a déjà été traitée.')
        return redirect(queueUrl, 303)
      }

      await db.transaction(async (tx) => {
        await decideCollectif(tx, collectif.id, {
          status: 'rejected',
          adminId: actor.id,
          rejectionReason: reason,
        })
        await logAction(tx, {
          actorId: actor.id,
          action: 'collectif.rejected',
          entity: 'collectif',
          entityId: collectif.id,
          payload: { withReason: reason !== null },
        })
      })
      const requester = collectif.requested_by
        ? await findUserById(db, collectif.requested_by)
        : null
      if (requester) {
        await sendSafely(mailer, collectifRejectedMail(requester.email, collectif.name, reason))
      }
      session.flash('notice', `Demande « ${collectif.name} » refusée.`)
      return redirect(queueUrl, 303)
    },
  },
})
