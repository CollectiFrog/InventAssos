import * as f from 'remix/data-schema/form-data'
import { redirect } from 'remix/response/redirect'
import { createController } from 'remix/router'

import { logAction } from '../../data/audit-log.ts'
import { findCollectifById } from '../../data/collectifs.ts'
import {
  countActiveResponsiblesForUpdate,
  findResponsible,
  setResponsible,
} from '../../data/responsibles.ts'
import { findUserByEmail, findUserById } from '../../data/users.ts'
import { sendSafely } from '../../mail/mailer.ts'
import {
  responsibleApprovedMail,
  responsibleRejectedMail,
  responsibleRemovedMail,
} from '../../mail/messages.ts'
import { canManageResponsibles } from '../../permissions.ts'
import { routes } from '../../routes.ts'
import { optionalText, parseForm } from '../../validation.ts'
import { forbidden, requireUser } from '../guards.tsx'

const queueUrl = routes.admin.index.href()
const removeSchema = f.object({ replacementEmail: f.field(optionalText(254)) })

/** Thrown inside the removal transaction to roll it back with a message for the admin. */
class RemovalRefused extends Error {}

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

    // US-0.3.6: an active collectif never loses its last responsible without a replacement.
    async remove(context) {
      const actor = requireUser(context)
      if (actor instanceof Response) return actor
      if (!canManageResponsibles(actor)) return forbidden(context)

      const { db, mailer, session, params } = context
      const collectif = await findCollectifById(db, params.collectifId)
      const user = await findUserById(db, params.userId)
      const link = await findResponsible(db, params.userId, params.collectifId)
      if (collectif === null || user === null || link?.status !== 'active') {
        session.flash('notice', 'Cette personne n’est pas responsable de ce collectif.')
        return redirect(queueUrl, 303)
      }
      const backUrl =
        collectif.status === 'active'
          ? routes.collectifs.show.href({ slug: collectif.slug })
          : queueUrl

      const parsed = parseForm(removeSchema, context.formData)
      const replacementEmail = parsed.ok ? parsed.value.replacementEmail : null
      const replacement = replacementEmail ? await findUserByEmail(db, replacementEmail) : null
      if (replacementEmail && (replacement?.status !== 'active' || replacement.id === user.id)) {
        session.flash('notice', 'Le remplaçant doit être un autre utilisateur validé.')
        return redirect(backUrl, 303)
      }

      try {
        await db.transaction(async (tx) => {
          if (replacement) {
            await setResponsible(tx, {
              userId: replacement.id,
              collectifId: collectif.id,
              status: 'active',
              validatedBy: actor.id,
            })
          }
          const remaining = (await countActiveResponsiblesForUpdate(tx, collectif.id)) - 1
          if (collectif.status === 'active' && remaining < 1) throw new RemovalRefused()

          await setResponsible(tx, {
            userId: user.id,
            collectifId: collectif.id,
            status: 'removed',
            validatedBy: actor.id,
          })
          await logAction(tx, {
            actorId: actor.id,
            action: 'responsible.removed',
            entity: 'collectif',
            entityId: collectif.id,
            payload: { userId: user.id, replacementId: replacement?.id ?? null },
          })
        })
      } catch (error) {
        if (!(error instanceof RemovalRefused)) throw error
        session.flash(
          'notice',
          'C’est le dernier responsable : indiquez un remplaçant pour pouvoir le retirer.',
        )
        return redirect(backUrl, 303)
      }

      await sendSafely(mailer, responsibleRemovedMail(user.email, collectif.name))
      session.flash('notice', `${user.name} n’est plus responsable de « ${collectif.name} ».`)
      return redirect(backUrl, 303)
    },
  },
})
