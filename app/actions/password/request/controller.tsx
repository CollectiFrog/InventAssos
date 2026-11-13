import * as f from 'remix/data-schema/form-data'
import type { Database } from 'remix/data-table'
import { getCsrfToken } from 'remix/middleware/csrf'
import { redirect } from 'remix/response/redirect'
import { createController } from 'remix/router'

import { clientAddressOf } from '../../../client-address.ts'
import { createSignInToken } from '../../../data/sign-in-tokens.ts'
import { findUserByEmail } from '../../../data/users.ts'
import { type Mailer, sendSafely } from '../../../mail/mailer.ts'
import { passwordResetMail } from '../../../mail/messages.ts'
import { signedInStatuses } from '../../../middleware/current-user.ts'
import type { AppSettings } from '../../../middleware/services.ts'
import { hitFormFromClient, mayMailAddress } from '../../../rate-limits.ts'
import { routes } from '../../../routes.ts'
import { emailAddress, formValue, parseForm } from '../../../validation.ts'
import { tooManyRequests } from '../../guards.tsx'
import { viewerOf } from '../../viewer.ts'
import { PasswordRequestPage } from '../password-pages.tsx'

const requestSchema = f.object({ email: f.field(emailAddress()) })

/** E-mails a password link if the address has an account that may sign in and is not over its limit. */
async function sendPasswordLink(
  db: Database,
  mailer: Mailer,
  settings: AppSettings,
  email: string,
): Promise<void> {
  if (!(await mayMailAddress(db, settings, email))) return
  const user = await findUserByEmail(db, email)
  if (user === null || !signedInStatuses.has(user.status)) return
  const token = await createSignInToken(db, user.id, 'password_reset')
  const url = settings.appUrl + routes.password.choose.index.href({ token })
  await sendSafely(mailer, passwordResetMail(user.email, url))
}

/** Ask for a link to choose a password (US-0.10.8): the only way to create or change one. */
export default createController(routes.password.request, {
  actions: {
    index(context) {
      return context.render(
        <PasswordRequestPage
          viewer={viewerOf(context)}
          csrfToken={getCsrfToken(context)}
          email={context.currentUser?.email}
        />,
      )
    },

    async action(context) {
      const parsed = parseForm(requestSchema, context.formData)
      if (!parsed.ok) {
        return context.render(
          <PasswordRequestPage
            viewer={viewerOf(context)}
            csrfToken={getCsrfToken(context)}
            email={formValue(context.formData, 'email')}
            errors={parsed.errors}
          />,
          { status: 400 },
        )
      }

      const { db, mailer, settings, background } = context
      const client = await hitFormFromClient(db, settings, clientAddressOf(context.request))
      if (!client.allowed) return tooManyRequests(context, client.retryAfterSeconds)

      // After the response, and the same answer: nothing tells whether the e-mail has an account.
      const email = parsed.value.email
      background.run(() => sendPasswordLink(db, mailer, settings, email))
      return redirect(routes.password.sent.href(), 303)
    },
  },
})
