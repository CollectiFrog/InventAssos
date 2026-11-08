import * as f from 'remix/data-schema/form-data'
import { getCsrfToken } from 'remix/middleware/csrf'
import { redirect } from 'remix/response/redirect'
import { createController } from 'remix/router'

import { createUser, findUserByEmail, setUserStatus } from '../../data/users.ts'
import { sendSafely } from '../../mail/mailer.ts'
import {
  alreadyRegisteredMail,
  newAccountRequestMail,
  signUpReceivedMail,
} from '../../mail/messages.ts'
import { routes } from '../../routes.ts'
import { emailAddress, formValue, parseForm, requiredText } from '../../validation.ts'
import { SignUpPage, SignUpSentPage } from './sign-up-page.tsx'

const signUpSchema = f.object({
  name: f.field(requiredText(120)),
  email: f.field(emailAddress()),
})

/** GET shows the form, POST records the request (US-0.2.1). */
export const signUpFormController = createController(routes.signUp.form, {
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

      const { name, email } = parsed.value
      const { db, mailer, settings } = context
      const admins = [...settings.adminEmails]
      const existing = await findUserByEmail(db, email)

      if (existing === null) {
        await createUser(db, { name, email })
        await sendSafely(mailer, signUpReceivedMail(email, settings.appUrl))
        if (admins.length > 0)
          await sendSafely(
            mailer,
            newAccountRequestMail(admins, settings.appUrl + routes.admin.index.href()),
          )
      } else if (existing.status === 'rejected') {
        // A rejected person may apply again (open point US-0.2.4): back to the queue.
        await setUserStatus(db, existing.id, 'pending')
        await sendSafely(mailer, signUpReceivedMail(email, settings.appUrl))
        if (admins.length > 0)
          await sendSafely(
            mailer,
            newAccountRequestMail(admins, settings.appUrl + routes.admin.index.href()),
          )
      } else {
        // Same answer as a new sign-up, so the form never reveals which e-mails have an account.
        await sendSafely(
          mailer,
          alreadyRegisteredMail(email, settings.appUrl + routes.signIn.form.index.href()),
        )
      }

      return redirect(routes.signUp.sent.href(), 303)
    },
  },
})

/** Confirmation page, identical for every outcome. */
export const signUpController = createController(routes.signUp, {
  actions: {
    sent(context) {
      return context.render(<SignUpSentPage />)
    },
  },
})
