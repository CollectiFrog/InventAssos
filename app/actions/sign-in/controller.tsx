import * as f from 'remix/data-schema/form-data'
import { getCsrfToken } from 'remix/middleware/csrf'
import { redirect } from 'remix/response/redirect'
import { createController } from 'remix/router'

import { clientAddressOf } from '../../client-address.ts'
import { consumeSignInToken } from '../../data/sign-in-tokens.ts'
import { findUserByEmail, findUserById, syncPlatformAdmin } from '../../data/users.ts'
import { signedInStatuses } from '../../middleware/current-user.ts'
import { verifyPassword } from '../../passwords.ts'
import { hitFormFromClient, hitPasswordTry } from '../../rate-limits.ts'
import { routes } from '../../routes.ts'
import type { FieldErrors } from '../../ui/form.tsx'
import { emailAddress, formValue, parseForm } from '../../validation.ts'
import { tooManyRequests } from '../guards.tsx'
import { returnParam, safeReturnPath } from '../return-path.ts'
import { startSession } from './session.ts'
import { SignInLinkInvalidPage, SignInPage, SignInSentPage } from './sign-in-pages.tsx'

const passwordSchema = f.object({ email: f.field(emailAddress()) })

/** Confirmation page after a link request, the link from the e-mail, and password sign-in. */
export default createController(routes.signIn, {
  actions: {
    sent(context) {
      return context.render(<SignInSentPage />)
    },

    // Opening the link signs in at once; a mail scanner that opens it first uses it up (accepted,
    // see docs/dev/architecture/overview.md).
    async link(context) {
      // HEAD is what link checkers send: answer without using the token.
      if (context.request.method === 'HEAD') return new Response(null, { status: 204 })
      const { db, settings } = context
      const userId = await consumeSignInToken(db, context.params.token)
      let user = userId === null ? null : await findUserById(db, userId)
      if (user !== null) user = await syncPlatformAdmin(db, user, settings.adminEmails)
      if (user === null || !signedInStatuses.has(user.status)) {
        return context.render(<SignInLinkInvalidPage />, { status: 400 })
      }

      startSession(context, user.id)
      // US-0.7.8: back to the page asked for before signing in, if it is one of ours.
      const returnPath = safeReturnPath(context.url.searchParams.get(returnParam))
      return redirect(returnPath ?? routes.home.href(), 303)
    },

    // US-0.10.8: one answer for an unknown address, a wrong password or an account without one.
    async password(context) {
      const { db, settings } = context
      const returnPath = safeReturnPath(formValue(context.formData, returnParam))
      const password = formValue(context.formData, 'password')
      const parsed = parseForm(passwordSchema, context.formData)
      const refuse = (errors: FieldErrors, status = 400) =>
        context.render(
          <SignInPage
            csrfToken={getCsrfToken(context)}
            email={formValue(context.formData, 'email')}
            errors={errors}
            returnPath={returnPath}
          />,
          { status },
        )
      if (!parsed.ok) return refuse(parsed.errors)
      if (password === '') {
        return refuse({ password: 'Saisissez votre mot de passe, ou recevez un lien par e-mail.' })
      }

      const client = await hitFormFromClient(db, settings, clientAddressOf(context.request))
      if (!client.allowed) return tooManyRequests(context, client.retryAfterSeconds)
      const email = parsed.value.email
      if (!(await hitPasswordTry(db, settings, email)).allowed) {
        const tooMany =
          'Trop d’essais pour cette adresse. Réessayez dans une heure, ou recevez un lien par e-mail.'
        return refuse({ password: tooMany }, 429)
      }

      let user = await findUserByEmail(db, email)
      const matches = await verifyPassword(password, user?.password_hash ?? null)
      if (user !== null && matches) user = await syncPlatformAdmin(db, user, settings.adminEmails)
      if (user === null || !matches || !signedInStatuses.has(user.status)) {
        return refuse({ password: 'Adresse e-mail ou mot de passe incorrect.' })
      }

      startSession(context, user.id)
      return redirect(returnPath ?? routes.home.href(), 303)
    },
  },
})
