import { getCsrfToken } from 'remix/middleware/csrf'
import { redirect } from 'remix/response/redirect'
import { createController } from 'remix/router'

import { findUserById, setUserStatus } from '../../data/users.ts'
import { sendSafely } from '../../mail/mailer.ts'
import { newAccountRequestMail } from '../../mail/messages.ts'
import { routes } from '../../routes.ts'
import { viewerOf } from '../viewer.ts'
import { StatusPage } from './status-page.tsx'

export default createController(routes.account, {
  actions: {
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

      await setUserStatus(context.db, current.id, 'pending')
      const admins = [...context.settings.adminEmails]
      if (admins.length > 0) {
        await sendSafely(context.mailer, newAccountRequestMail(admins, context.settings.appUrl))
      }
      return redirect(routes.account.status.href(), 303)
    },
  },
})
