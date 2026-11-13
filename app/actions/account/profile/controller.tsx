import * as f from 'remix/data-schema/form-data'
import { getCsrfToken } from 'remix/middleware/csrf'
import { redirect } from 'remix/response/redirect'
import { createController } from 'remix/router'

import { listPendingCollectifs } from '../../../data/collectifs.ts'
import { listPendingResponsibles } from '../../../data/members.ts'
import { findUserById, listPendingUsers, updateProfile } from '../../../data/users.ts'
import type { AppContext } from '../../../middleware/index.ts'
import { canEditOwnProfile, canReviewAccounts } from '../../../permissions.ts'
import { routes } from '../../../routes.ts'
import { formValue, optionalPhone, parseForm, requiredText } from '../../../validation.ts'
import { forbidden, requireUser } from '../../guards.tsx'
import { viewerOf } from '../../viewer.ts'
import { ProfilePage } from './profile-page.tsx'

/** Requests waiting in Administration, for staff only: others get no section (US-0.10.9). */
async function pendingRequestsFor(context: AppContext): Promise<number | undefined> {
  if (!canReviewAccounts(context.currentUser)) return undefined
  const { db } = context
  const counts = await Promise.all([
    listPendingUsers(db),
    listPendingCollectifs(db),
    listPendingResponsibles(db),
  ])
  return counts.reduce((total, list) => total + list.length, 0)
}

const profileSchema = f.object({
  name: f.field(requiredText(120)),
  phone: f.field(optionalPhone()),
})

export default createController(routes.account.profile, {
  actions: {
    async index(context) {
      const actor = requireUser(context)
      if (actor instanceof Response) return actor
      if (!canEditOwnProfile(actor)) return forbidden(context)

      const user = await findUserById(context.db, actor.id)
      if (user === null) return forbidden(context)
      return context.render(
        <ProfilePage
          viewer={viewerOf(context)}
          csrfToken={getCsrfToken(context)}
          email={user.email}
          values={{ name: user.name, phone: user.phone ?? '' }}
          collectifs={actor.collectifs}
          hasPassword={user.password_hash !== null}
          pendingRequests={await pendingRequestsFor(context)}
          saved={context.session.get('profileSaved') === true}
        />,
      )
    },

    async action(context) {
      const actor = requireUser(context)
      if (actor instanceof Response) return actor
      if (!canEditOwnProfile(actor)) return forbidden(context)

      const parsed = parseForm(profileSchema, context.formData)
      if (!parsed.ok) {
        const user = await findUserById(context.db, actor.id)
        return context.render(
          <ProfilePage
            viewer={viewerOf(context)}
            csrfToken={getCsrfToken(context)}
            email={actor.email}
            values={{
              name: formValue(context.formData, 'name'),
              phone: formValue(context.formData, 'phone'),
            }}
            collectifs={actor.collectifs}
            hasPassword={user?.password_hash != null}
            pendingRequests={await pendingRequestsFor(context)}
            errors={parsed.errors}
          />,
          { status: 400 },
        )
      }

      // Always the signed-in person's own account: no user ID comes from the form.
      await updateProfile(context.db, actor.id, parsed.value)
      context.session.flash('profileSaved', true)
      return redirect(routes.account.profile.index.href(), 303)
    },
  },
})
