import { getCsrfToken } from 'remix/middleware/csrf'
import { redirect } from 'remix/response/redirect'
import { createController } from 'remix/router'

import { findUserById, setUserStatus } from '../../data/users.ts'
import { newAccountRequestMail } from '../../mail/messages.ts'
import { canEditOwnProfile } from '../../permissions.ts'
import { hitUserRequest, notifyAdmins } from '../../rate-limits.ts'
import { routes } from '../../routes.ts'
import { forbidden, requireUser, tooManyRequests } from '../guards.tsx'
import { viewerOf } from '../viewer.ts'
import { DeleteAccountPage } from './profile/profile-page.tsx'
import { StatusPage } from './status-page.tsx'

export default createController(routes.account, {
  actions: {
    // US-0.7.13: the page exists; deleting itself comes with US-1.0.4 (V1.0).
    deletion(context) {
      const actor = requireUser(context)
      if (actor instanceof Response) return actor
      if (!canEditOwnProfile(actor)) return forbidden(context)
      return context.render(<DeleteAccountPage viewer={viewerOf(context)} />)
    },

    async status(context) {
      const current = context.currentUser
      if (current === null) return redirect(routes.signIn.form.index.href(), 303)
      if (current.status === 'active') return redirect(routes.home.href(), 303)

      const user = await findUserById(context.db, current.id)
      return context.render(
        <StatusPage
          viewer={viewerOf(context)}
          status={current.status === 'rejected' ? 'rejected' : 'pending'}
          rejectionReason={user?.rejection_reason ?? null}
          csrfToken={getCsrfToken(context)}
        />,
      )
    },

    // A rejected person may apply again (open point US-0.2.4, proposal "yes").
    async reapply(context) {
      const current = context.currentUser
      if (current === null) return redirect(routes.signIn.form.index.href(), 303)
      if (current.status !== 'rejected') return redirect(routes.account.status.href(), 303)

      const { db, mailer, settings } = context
      const limit = await hitUserRequest(db, settings, current.id)
      if (!limit.allowed) return tooManyRequests(context, limit.retryAfterSeconds)

      await setUserStatus(db, current.id, 'pending')
      const reviewUrl = settings.appUrl + routes.admin.index.href()
      await notifyAdmins(db, mailer, settings, 'account', (admins) =>
        newAccountRequestMail(admins, reviewUrl),
      )
      return redirect(routes.account.status.href(), 303)
    },
  },
})
