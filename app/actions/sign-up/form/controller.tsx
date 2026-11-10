import * as f from 'remix/data-schema/form-data'
import type { Database } from 'remix/data-table'
import { getCsrfToken } from 'remix/middleware/csrf'
import { redirect } from 'remix/response/redirect'
import { createController } from 'remix/router'

import { clientAddressOf } from '../../../client-address.ts'
import { createUser, findUserByEmail } from '../../../data/users.ts'
import { type Mailer, sendSafely } from '../../../mail/mailer.ts'
import {
  alreadyRegisteredMail,
  newAccountRequestMail,
  reapplyBySignInMail,
  signUpReceivedMail,
} from '../../../mail/messages.ts'
import type { AppSettings } from '../../../middleware/services.ts'
import { hitFormFromClient, mayMailAddress, notifyAdmins } from '../../../rate-limits.ts'
import { routes } from '../../../routes.ts'
import { emailAddress, formValue, parseForm, requiredText } from '../../../validation.ts'
import { tooManyRequests } from '../../guards.tsx'
import { SignUpPage } from '../sign-up-page.tsx'

const signUpSchema = f.object({
  name: f.field(requiredText(120)),
  email: f.field(emailAddress()),
})
/** Creates the pending account and sends the e-mails; the visitor already has the same answer. */
async function recordSignUp(
  db: Database,
  mailer: Mailer,
  settings: AppSettings,
  name: string,
  email: string,
): Promise<void> {
  if (!(await mayMailAddress(db, settings, email))) return
  const existing = await findUserByEmail(db, email)
  if (existing === null) {
    await createUser(db, { name, email })
    await sendSafely(mailer, signUpReceivedMail(email, settings.appUrl))
    const reviewUrl = settings.appUrl + routes.admin.index.href()
    await notifyAdmins(db, mailer, settings, 'account', (admins) =>
      newAccountRequestMail(admins, reviewUrl),
    )
  } else if (existing.status === 'rejected') {
    // Only the mailbox owner may apply again: they sign in and use their status page (US-0.2.4).
    await sendSafely(
      mailer,
      reapplyBySignInMail(email, settings.appUrl + routes.signIn.form.index.href()),
    )
  } else {
    await sendSafely(
      mailer,
      alreadyRegisteredMail(email, settings.appUrl + routes.signIn.form.index.href()),
    )
  }
}

/** GET shows the form, POST records the request (US-0.2.1). */
export default createController(routes.signUp.form, {
  actions: {
    index(context) {
      return context.render(<SignUpPage csrfToken={getCsrfToken(context)} />)
    },

    async action(context) {
      const parsed = parseForm(signUpSchema, context.formData)
      if (!parsed.ok) {
        const values = {
          name: formValue(context.formData, 'name'),
          email: formValue(context.formData, 'email'),
        }
        return context.render(
          <SignUpPage csrfToken={getCsrfToken(context)} values={values} errors={parsed.errors} />,
          { status: 400 },
        )
      }

      const { db, mailer, settings, background } = context
      const client = await hitFormFromClient(db, settings, clientAddressOf(context.request))
      if (!client.allowed) return tooManyRequests(context, client.retryAfterSeconds)

      // After the response: its timing must not tell whether the e-mail has an account (US-0.2.2).
      const { name, email } = parsed.value
      background.run(() => recordSignUp(db, mailer, settings, name, email))

      return redirect(routes.signUp.sent.href(), 303)
    },
  },
})
