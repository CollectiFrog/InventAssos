import * as f from 'remix/data-schema/form-data'
import type { Database } from 'remix/data-table'
import { getCsrfToken } from 'remix/middleware/csrf'
import { redirect } from 'remix/response/redirect'
import { createController } from 'remix/router'

import { clientAddressOf } from '../../../client-address.ts'

import { createSignInToken } from '../../../data/sign-in-tokens.ts'
import { createUser, findUserByEmail, syncPlatformAdmin } from '../../../data/users.ts'
import { type Mailer, sendSafely } from '../../../mail/mailer.ts'
import { signInLinkMail } from '../../../mail/messages.ts'
import { signedInStatuses } from '../../../middleware/current-user.ts'
import type { AppSettings } from '../../../middleware/services.ts'
import { hitFormFromClient, mayMailAddress } from '../../../rate-limits.ts'
import { routes } from '../../../routes.ts'
import { emailAddress, formValue, parseForm } from '../../../validation.ts'
import { tooManyRequests } from '../../guards.tsx'
import { returnParam, safeReturnPath, withReturnPath } from '../../return-path.ts'
import { SignInPage } from '../sign-in-pages.tsx'

const signInSchema = f.object({ email: f.field(emailAddress()) })

/** E-mails a sign-in link if the address has an account that may sign in and is not over its limit. */
async function sendSignInLink(
  db: Database,
  mailer: Mailer,
  settings: AppSettings,
  email: string,
  returnPath: string | null,
): Promise<void> {
  if (!(await mayMailAddress(db, settings, email))) return
  let user = await findUserByEmail(db, email)
  // A listed platform admin may sign in before anyone created their account (US-0.2.5).
  if (user === null && settings.adminEmails.has(email)) {
    user = await createUser(db, { email, name: email.split('@')[0] ?? email, status: 'active' })
  }
  if (user !== null) user = await syncPlatformAdmin(db, user, settings.adminEmails)
  if (user !== null && signedInStatuses.has(user.status)) {
    const token = await createSignInToken(db, user.id)
    const url = settings.appUrl + withReturnPath(routes.signIn.link.href({ token }), returnPath)
    await sendSafely(mailer, signInLinkMail(user.email, url))
  }
}

/** Request a sign-in link (US-0.2.2). */
export default createController(routes.signIn.form, {
  actions: {
    index(context) {
      const returnPath = safeReturnPath(context.url.searchParams.get(returnParam))
      return context.render(
        <SignInPage csrfToken={getCsrfToken(context)} returnPath={returnPath} />,
      )
    },

    async action(context) {
      const parsed = parseForm(signInSchema, context.formData)
      const returnPath = safeReturnPath(formValue(context.formData, returnParam))
      if (!parsed.ok) {
        return context.render(
          <SignInPage
            csrfToken={getCsrfToken(context)}
            email={formValue(context.formData, 'email')}
            errors={parsed.errors}
            returnPath={returnPath}
          />,
          { status: 400 },
        )
      }

      const { db, mailer, settings, background } = context
      const client = await hitFormFromClient(db, settings, clientAddressOf(context.request))
      if (!client.allowed) return tooManyRequests(context, client.retryAfterSeconds)

      // After the response: its timing must not tell whether the e-mail has an account (US-0.2.2).
      const email = parsed.value.email
      background.run(() => sendSignInLink(db, mailer, settings, email, returnPath))

      // Same answer whether or not the e-mail has an account.
      return redirect(routes.signIn.sent.href(), 303)
    },
  },
})
