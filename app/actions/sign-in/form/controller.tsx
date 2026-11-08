import * as f from 'remix/data-schema/form-data'
import { getCsrfToken } from 'remix/middleware/csrf'
import { redirect } from 'remix/response/redirect'
import { createController } from 'remix/router'

import { createSignInToken } from '../../../data/sign-in-tokens.ts'
import { createUser, findUserByEmail, syncPlatformAdmin } from '../../../data/users.ts'
import { sendSafely } from '../../../mail/mailer.ts'
import { signInLinkMail } from '../../../mail/messages.ts'
import { signedInStatuses } from '../../../middleware/current-user.ts'
import { routes } from '../../../routes.ts'
import { emailAddress, formValue, parseForm } from '../../../validation.ts'
import { SignInPage } from '../sign-in-pages.tsx'

const signInSchema = f.object({ email: f.field(emailAddress()) })

/** Request a sign-in link (US-0.2.2). */
export default createController(routes.signIn.form, {
  actions: {
    index(context) {
      return context.render(<SignInPage csrfToken={getCsrfToken(context)} />)
    },

    async action(context) {
      const parsed = parseForm(signInSchema, context.formData)
      if (!parsed.ok) {
        return context.render(
          <SignInPage
            csrfToken={getCsrfToken(context)}
            email={formValue(context.formData, 'email')}
            errors={parsed.errors}
          />,
          { status: 400 },
        )
      }

      const { db, mailer, settings } = context
      const email = parsed.value.email
      let user = await findUserByEmail(db, email)
      // A listed platform admin may sign in before anyone created their account (US-0.2.5).
      if (user === null && settings.adminEmails.has(email)) {
        user = await createUser(db, { email, name: email.split('@')[0] ?? email, status: 'active' })
      }
      if (user !== null) user = await syncPlatformAdmin(db, user, settings.adminEmails)
      if (user !== null && signedInStatuses.has(user.status)) {
        const token = await createSignInToken(db, user.id)
        const url = settings.appUrl + routes.signIn.link.index.href({ token })
        await sendSafely(mailer, signInLinkMail(user.email, url))
      }

      // Same answer whether or not the e-mail has an account.
      return redirect(routes.signIn.sent.href(), 303)
    },
  },
})
