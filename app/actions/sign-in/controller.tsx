import * as f from 'remix/data-schema/form-data'
import { getCsrfToken } from 'remix/middleware/csrf'
import { redirect } from 'remix/response/redirect'
import { createController } from 'remix/router'

import { consumeSignInToken, createSignInToken } from '../../data/sign-in-tokens.ts'
import { createUser, findUserByEmail, findUserById, syncPlatformAdmin } from '../../data/users.ts'
import { sendSafely } from '../../mail/mailer.ts'
import { signInLinkMail } from '../../mail/messages.ts'
import { sessionUserKey } from '../../middleware/current-user.ts'
import { routes } from '../../routes.ts'
import { emailAddress, formValue, parseForm } from '../../validation.ts'
import {
  SignInLinkInvalidPage,
  SignInLinkPage,
  SignInPage,
  SignInSentPage,
} from './sign-in-pages.tsx'

const signInSchema = f.object({ email: f.field(emailAddress()) })

/** Statuses allowed to sign in; disabled and deleted accounts never get a link. */
const canSignIn = new Set(['pending', 'active', 'rejected'])

/** Request a sign-in link (US-0.2.2). */
export const signInFormController = createController(routes.signIn.form, {
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
      if (user !== null && canSignIn.has(user.status)) {
        const token = await createSignInToken(db, user.id)
        const url = settings.appUrl + routes.signIn.link.index.href({ token })
        await sendSafely(mailer, signInLinkMail(user.email, url))
      }

      // Same answer whether or not the e-mail has an account.
      return redirect(routes.signIn.sent.href(), 303)
    },
  },
})

/** Confirmation page after a link request. */
export const signInController = createController(routes.signIn, {
  actions: {
    sent(context) {
      return context.render(<SignInSentPage />)
    },
  },
})

/** The link from the e-mail: GET asks for confirmation, POST signs in. */
export const signInLinkController = createController(routes.signIn.link, {
  actions: {
    index(context) {
      return context.render(
        <SignInLinkPage csrfToken={getCsrfToken(context)} token={context.params.token} />,
      )
    },

    async action(context) {
      const { db, session, settings } = context
      const userId = await consumeSignInToken(db, context.params.token)
      let user = userId === null ? null : await findUserById(db, userId)
      if (user !== null) user = await syncPlatformAdmin(db, user, settings.adminEmails)
      if (user === null || !canSignIn.has(user.status)) {
        return context.render(<SignInLinkInvalidPage />, { status: 400 })
      }

      // New session ID on sign-in, old one deleted: prevents session fixation.
      session.regenerateId(true)
      session.set(sessionUserKey, user.id)
      return redirect(routes.home.href(), 303)
    },
  },
})
