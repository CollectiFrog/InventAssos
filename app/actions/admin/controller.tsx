import * as f from 'remix/data-schema/form-data'
import { getCsrfToken } from 'remix/middleware/csrf'
import { redirect } from 'remix/response/redirect'
import { createController } from 'remix/router'

import { logAction } from '../../data/audit-log.ts'
import { listPendingCollectifs } from '../../data/collectifs.ts'
import { listPendingResponsibles } from '../../data/responsibles.ts'
import { deleteUserSessions } from '../../data/sessions.ts'
import { findUserById, listActiveUsers, listPendingUsers, setUserStatus } from '../../data/users.ts'
import { sendSafely } from '../../mail/mailer.ts'
import { accountApprovedMail, accountRejectedMail } from '../../mail/messages.ts'
import { canDisableAccount, canReviewAccounts } from '../../permissions.ts'
import { routes } from '../../routes.ts'
import { optionalText, parseForm } from '../../validation.ts'
import { forbidden, requireUser } from '../guards.tsx'
import { viewerOf } from '../viewer.ts'
import { QueuePage } from './queue-page.tsx'

const rejectSchema = f.object({ reason: f.field(optionalText(500)) })

export default createController(routes.admin, {
  actions: {
    async index(context) {
      const actor = requireUser(context)
      if (actor instanceof Response) return actor
      if (!canReviewAccounts(actor)) return forbidden(context)

      const notice = context.session.get('notice')
      return context.render(
        <QueuePage
          viewer={viewerOf(context)}
          csrfToken={getCsrfToken(context)}
          pending={await listPendingUsers(context.db)}
          pendingCollectifs={await listPendingCollectifs(context.db)}
          pendingResponsibles={await listPendingResponsibles(context.db)}
          active={await listActiveUsers(context.db)}
          selfId={actor.id}
          notice={typeof notice === 'string' ? notice : undefined}
        />,
      )
    },

    async approveAccount(context) {
      const actor = requireUser(context)
      if (actor instanceof Response) return actor
      if (!canReviewAccounts(actor)) return forbidden(context)

      const { db, mailer, settings, session } = context
      const user = await findUserById(db, context.params.userId)
      if (user === null || user.status !== 'pending') {
        session.flash('notice', 'Cette demande a déjà été traitée.')
        return redirect(routes.admin.index.href(), 303)
      }

      await db.transaction(async (tx) => {
        await setUserStatus(tx, user.id, 'active')
        await logAction(tx, {
          actorId: actor.id,
          action: 'account.approved',
          entity: 'user',
          entityId: user.id,
        })
      })
      await sendSafely(
        mailer,
        accountApprovedMail(user.email, settings.appUrl + routes.signIn.form.index.href()),
      )
      session.flash('notice', `Compte de ${user.name} accepté.`)
      return redirect(routes.admin.index.href(), 303)
    },

    async rejectAccount(context) {
      const actor = requireUser(context)
      if (actor instanceof Response) return actor
      if (!canReviewAccounts(actor)) return forbidden(context)

      const { db, mailer, session } = context
      const parsed = parseForm(rejectSchema, context.formData)
      const reason = parsed.ok ? parsed.value.reason : null
      const user = await findUserById(db, context.params.userId)
      if (user === null || user.status !== 'pending') {
        session.flash('notice', 'Cette demande a déjà été traitée.')
        return redirect(routes.admin.index.href(), 303)
      }

      await db.transaction(async (tx) => {
        await setUserStatus(tx, user.id, 'rejected', reason)
        // The reason is free text: it stays on the account, never in the log (ADR 0010).
        await logAction(tx, {
          actorId: actor.id,
          action: 'account.rejected',
          entity: 'user',
          entityId: user.id,
          payload: { withReason: reason !== null },
        })
      })
      await sendSafely(mailer, accountRejectedMail(user.email, reason))
      session.flash('notice', `Demande de ${user.name} refusée.`)
      return redirect(routes.admin.index.href(), 303)
    },

    async disableAccount(context) {
      const actor = requireUser(context)
      if (actor instanceof Response) return actor
      if (!canDisableAccount(actor, context.params.userId)) return forbidden(context)

      const { db, session } = context
      const user = await findUserById(db, context.params.userId)
      if (user === null || user.status !== 'active') {
        session.flash('notice', 'Ce compte n’est pas actif.')
        return redirect(routes.admin.index.href(), 303)
      }

      await db.transaction(async (tx) => {
        await setUserStatus(tx, user.id, 'disabled')
        // Sessions are rows (ADR 0017): deleting them signs the person out everywhere at once.
        await deleteUserSessions(tx, user.id)
        await logAction(tx, {
          actorId: actor.id,
          action: 'account.disabled',
          entity: 'user',
          entityId: user.id,
        })
      })
      session.flash('notice', `Compte de ${user.name} désactivé.`)
      return redirect(routes.admin.index.href(), 303)
    },
  },
})
