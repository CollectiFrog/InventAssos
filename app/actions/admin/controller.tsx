import * as f from 'remix/data-schema/form-data'
import { getCsrfToken } from 'remix/middleware/csrf'
import { redirect } from 'remix/response/redirect'
import { createController } from 'remix/router'

import { logAction } from '../../data/audit-log.ts'
import { listPendingCollectifs } from '../../data/collectifs.ts'
import { listCollectifsRelyingOn, listPendingResponsibles } from '../../data/members.ts'
import { deleteUserSessions } from '../../data/sessions.ts'
import type { User } from '../../data/tables.ts'
import {
  findUserById,
  listActiveUsers,
  listDisabledUsers,
  listPendingUsers,
  setUserStatus,
} from '../../data/users.ts'
import { sendSafely } from '../../mail/mailer.ts'
import { accountApprovedMail, accountRejectedMail } from '../../mail/messages.ts'
import type { AppContext } from '../../middleware/index.ts'
import {
  canDisableAccount,
  canEnableAccount,
  canReviewAccounts,
} from '../../permissions.ts'
import { routes } from '../../routes.ts'
import { optionalText, parseForm } from '../../validation.ts'
import { accountTargetOf } from '../account-target.ts'
import { forbidden, requireUser } from '../guards.tsx'
import { viewerOf } from '../viewer.ts'
import { type AccountRow, AccountsPage, QueuePage } from './queue-page.tsx'

const rejectSchema = f.object({ reason: f.field(optionalText(500)) })

/** Administration › Demandes, at /admin and /admin/demandes (ADR 0022). */
async function renderRequests(context: AppContext) {
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
      notice={typeof notice === 'string' ? notice : undefined}
    />,
  )
}

export default createController(routes.admin, {
  actions: {
    index: (context) => renderRequests(context),
    requests: (context) => renderRequests(context),

    async accounts(context) {
      const actor = requireUser(context)
      if (actor instanceof Response) return actor
      if (!canReviewAccounts(actor)) return forbidden(context)

      const notice = context.session.get('notice')
      const { adminEmails } = context.settings
      // Each row says who the account is and whether this viewer may act on it (US-0.8.2).
      const rowOf = (user: User): AccountRow => {
        const target = accountTargetOf(user, adminEmails)
        return {
          user,
          role:
            user.id === actor.id
              ? 'vous'
              : target.isListedAdmin
                ? 'administrateur'
                : target.isModerator
                  ? 'modérateur'
                  : undefined,
          canDisable: canDisableAccount(actor, target),
          canEnable: canEnableAccount(actor, target),
        }
      }
      return context.render(
        <AccountsPage
          viewer={viewerOf(context)}
          csrfToken={getCsrfToken(context)}
          active={(await listActiveUsers(context.db)).map(rowOf)}
          disabled={(await listDisabledUsers(context.db)).map(rowOf)}
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
      if (!canReviewAccounts(actor)) return forbidden(context)

      const { db, session, settings } = context
      const user = await findUserById(db, context.params.userId)
      if (user !== null && !canDisableAccount(actor, accountTargetOf(user, settings.adminEmails))) {
        return forbidden(context)
      }
      if (user === null || user.status !== 'active') {
        session.flash('notice', 'Ce compte n’est pas actif.')
        return redirect(routes.admin.accounts.href(), 303)
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
      // A disabled responsible cannot run a collectif: say which ones now need another one.
      const orphans = await listCollectifsRelyingOn(db, user.id)
      session.flash(
        'notice',
        orphans.length > 0
          ? `Compte de ${user.name} désactivé. Sans autre responsable actif : ${orphans.join(', ')}. Nommez-en un dans l’onglet Membres de chaque collectif.`
          : `Compte de ${user.name} désactivé.`,
      )
      return redirect(routes.admin.accounts.href(), 303)
    },

    // US-0.6.5: the way back from a disable, so no admin is ever locked out for good.
    async enableAccount(context) {
      const actor = requireUser(context)
      if (actor instanceof Response) return actor
      if (!canReviewAccounts(actor)) return forbidden(context)

      const { db, session, settings } = context
      const user = await findUserById(db, context.params.userId)
      if (user !== null && !canEnableAccount(actor, accountTargetOf(user, settings.adminEmails))) {
        return forbidden(context)
      }
      if (user === null || user.status !== 'disabled') {
        session.flash('notice', 'Ce compte n’est pas désactivé.')
        return redirect(routes.admin.accounts.href(), 303)
      }

      await db.transaction(async (tx) => {
        await setUserStatus(tx, user.id, 'active')
        await logAction(tx, {
          actorId: actor.id,
          action: 'account.enabled',
          entity: 'user',
          entityId: user.id,
        })
      })
      session.flash('notice', `Compte de ${user.name} réactivé.`)
      return redirect(routes.admin.accounts.href(), 303)
    },
  },
})
