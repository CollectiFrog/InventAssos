import { getCsrfToken } from 'remix/middleware/csrf'
import { redirect } from 'remix/response/redirect'
import { createController } from 'remix/router'

import { logAction } from '../../../data/audit-log.ts'
import { findUserByEmail, findUserById, listModerators, setUserRole } from '../../../data/users.ts'
import type { AppContext } from '../../../middleware/index.ts'
import { canNameModerators } from '../../../permissions.ts'
import { routes } from '../../../routes.ts'
import type { FieldErrors } from '../../../ui/form.tsx'
import { formValue } from '../../../validation.ts'
import { forbidden, requireUser } from '../../guards.tsx'
import { viewerOf } from '../../viewer.ts'
import { ModeratorsPage } from './moderators-page.tsx'

const listUrl = routes.admin.moderators.index.href()

/** The page, with what was typed and its error after a refused nomination. */
async function renderPage(
  context: AppContext,
  form?: { values: Record<string, string>; errors: FieldErrors },
) {
  const notice = context.session.get('notice')
  return context.render(
    <ModeratorsPage
      viewer={viewerOf(context)}
      csrfToken={getCsrfToken(context)}
      moderators={await listModerators(context.db)}
      values={form?.values ?? {}}
      errors={form?.errors ?? {}}
      notice={typeof notice === 'string' ? notice : undefined}
    />,
    { status: form ? 400 : 200 },
  )
}

/** Moderators are named and removed by admins only (US-0.8.1); each change is logged, IDs only. */
export default createController(routes.admin.moderators, {
  actions: {
    async index(context) {
      const actor = requireUser(context)
      if (actor instanceof Response) return actor
      if (!canNameModerators(actor)) return forbidden(context)
      return renderPage(context)
    },

    async name(context) {
      const actor = requireUser(context)
      if (actor instanceof Response) return actor
      if (!canNameModerators(actor)) return forbidden(context)

      const email = formValue(context.formData, 'email').trim().slice(0, 254)
      const refuse = (error: string) =>
        renderPage(context, { values: { email }, errors: { email: error } })
      if (email === '') return refuse('Ce champ est obligatoire.')
      const user = await findUserByEmail(context.db, email)
      if (user === null || user.status !== 'active') {
        return refuse('Aucun compte validé n’a cette adresse.')
      }
      if (context.settings.adminEmails.has(user.email)) {
        return refuse('Cette personne est administrateur : elle a déjà tous ces droits.')
      }
      if (user.role === 'moderator') return refuse('Cette personne est déjà modérateur.')

      await context.db.transaction(async (tx) => {
        await setUserRole(tx, user.id, 'moderator')
        await logAction(tx, {
          actorId: actor.id,
          action: 'user.moderator_named',
          entity: 'user',
          entityId: user.id,
        })
      })
      context.session.flash('notice', `${user.name} est maintenant modérateur.`)
      return redirect(listUrl, 303)
    },

    async remove(context) {
      const actor = requireUser(context)
      if (actor instanceof Response) return actor
      if (!canNameModerators(actor)) return forbidden(context)

      const user = await findUserById(context.db, context.params.userId)
      if (user === null || user.role !== 'moderator') {
        context.session.flash('notice', 'Cette personne n’est pas modérateur.')
        return redirect(listUrl, 303)
      }
      await context.db.transaction(async (tx) => {
        await setUserRole(tx, user.id, 'member')
        await logAction(tx, {
          actorId: actor.id,
          action: 'user.moderator_removed',
          entity: 'user',
          entityId: user.id,
        })
      })
      context.session.flash('notice', `${user.name} n’est plus modérateur.`)
      return redirect(listUrl, 303)
    },
  },
})
