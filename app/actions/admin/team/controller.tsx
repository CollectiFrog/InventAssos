import { getCsrfToken } from 'remix/middleware/csrf'
import { redirect } from 'remix/response/redirect'
import { createController } from 'remix/router'

import { logAction } from '../../../data/audit-log.ts'
import type { User, UserRole } from '../../../data/tables.ts'
import {
  findUserByEmail,
  findUserById,
  listListedAdmins,
  listUsersWithRole,
  setUserRole,
} from '../../../data/users.ts'
import type { AppContext } from '../../../middleware/index.ts'
import { canChangeRoleOf, canManageTeam } from '../../../permissions.ts'
import { routes } from '../../../routes.ts'
import type { FieldErrors } from '../../../ui/form.tsx'
import { formValue } from '../../../validation.ts'
import { accountTargetOf } from '../../account-target.ts'
import { forbidden, requireUser } from '../../guards.tsx'
import { viewerOf } from '../../viewer.ts'
import { type StaffRole, staffRoleLabels, TeamPage, type TeamRow } from './team-page.tsx'

const listUrl = routes.admin.team.index.href()

/** The audit actions of each change of role; the log keeps IDs only (ADR 0010). */
const namedAction: Record<StaffRole, string> = {
  moderator: 'user.moderator_named',
  admin: 'user.admin_named',
}
const removedAction: Record<StaffRole, string> = {
  moderator: 'user.moderator_removed',
  admin: 'user.admin_removed',
}

function isStaffRole(value: string): value is StaffRole {
  return value === 'moderator' || value === 'admin'
}

/** The page, with what was typed and its error after a refused nomination. */
async function renderPage(
  context: AppContext,
  form?: { values: Record<string, string>; errors: FieldErrors },
) {
  const notice = context.session.get('notice')
  const { db, settings } = context
  const actor = context.currentUser
  // A listed e-mail is an admin whatever its role column says; show it once, as listed.
  const listed = await listListedAdmins(db, settings.adminEmails)
  const named = (await listUsersWithRole(db, 'admin')).filter(
    (user) => !settings.adminEmails.has(user.email),
  )
  const moderators = (await listUsersWithRole(db, 'moderator')).filter(
    (user) => !settings.adminEmails.has(user.email),
  )
  const rowOf = (user: User): TeamRow => {
    const target = accountTargetOf(user, settings.adminEmails)
    return {
      user,
      canRemove: canChangeRoleOf(actor, target),
      isYou: user.id === actor?.id,
      listed: target.isListedAdmin,
    }
  }
  return context.render(
    <TeamPage
      viewer={viewerOf(context)}
      csrfToken={getCsrfToken(context)}
      listedAdmins={listed.map(rowOf)}
      namedAdmins={named.map(rowOf)}
      moderators={moderators.map(rowOf)}
      values={form?.values ?? {}}
      errors={form?.errors ?? {}}
      notice={typeof notice === 'string' ? notice : undefined}
    />,
    { status: form ? 400 : 200 },
  )
}

/**
 * Administration › Équipe: admins name and remove moderators and other admins (US-0.8.1,
 * US-0.10.7). Listed admins and one's own account are out of reach; each change is logged.
 */
export default createController(routes.admin.team, {
  actions: {
    async index(context) {
      const actor = requireUser(context)
      if (actor instanceof Response) return actor
      if (!canManageTeam(actor)) return forbidden(context)
      return renderPage(context)
    },

    async name(context) {
      const actor = requireUser(context)
      if (actor instanceof Response) return actor
      if (!canManageTeam(actor)) return forbidden(context)

      const email = formValue(context.formData, 'email').trim().slice(0, 254)
      const role = formValue(context.formData, 'role')
      const values = { email, role }
      const refuse = (field: 'email' | 'role', error: string) =>
        renderPage(context, { values, errors: { [field]: error } })
      if (email === '') return refuse('email', 'Ce champ est obligatoire.')
      if (!isStaffRole(role)) return refuse('role', 'Choisissez un rôle.')
      const user = await findUserByEmail(context.db, email)
      if (user === null || user.status !== 'active') {
        return refuse('email', 'Aucun compte validé n’a cette adresse.')
      }
      const target = accountTargetOf(user, context.settings.adminEmails)
      if (target.isListedAdmin) {
        return refuse('email', 'Cette personne est administrateur par la configuration.')
      }
      if (user.id === actor.id) return refuse('email', 'Vous ne pouvez pas changer votre rôle.')
      if (user.role === role) {
        return refuse('email', `Cette personne est déjà ${staffRoleLabels[role]}.`)
      }
      if (!canChangeRoleOf(actor, target)) return forbidden(context)

      const previous: UserRole = user.role
      await context.db.transaction(async (tx) => {
        await setUserRole(tx, user.id, role)
        if (isStaffRole(previous)) {
          await logAction(tx, {
            actorId: actor.id,
            action: removedAction[previous],
            entity: 'user',
            entityId: user.id,
          })
        }
        await logAction(tx, {
          actorId: actor.id,
          action: namedAction[role],
          entity: 'user',
          entityId: user.id,
        })
      })
      context.session.flash('notice', `${user.name} est maintenant ${staffRoleLabels[role]}.`)
      return redirect(listUrl, 303)
    },

    async remove(context) {
      const actor = requireUser(context)
      if (actor instanceof Response) return actor
      if (!canManageTeam(actor)) return forbidden(context)

      const user = await findUserById(context.db, context.params.userId)
      const role = user?.role ?? 'member'
      if (user === null || !isStaffRole(role)) {
        context.session.flash('notice', 'Cette personne n’a pas de rôle à retirer.')
        return redirect(listUrl, 303)
      }
      if (!canChangeRoleOf(actor, accountTargetOf(user, context.settings.adminEmails))) {
        return forbidden(context)
      }
      await context.db.transaction(async (tx) => {
        await setUserRole(tx, user.id, 'member')
        await logAction(tx, {
          actorId: actor.id,
          action: removedAction[role],
          entity: 'user',
          entityId: user.id,
        })
      })
      context.session.flash('notice', `${user.name} n’est plus ${staffRoleLabels[role]}.`)
      return redirect(listUrl, 303)
    },
  },
})
