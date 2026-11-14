import { getCsrfToken } from 'remix/middleware/csrf'
import { redirect } from 'remix/response/redirect'
import { createController } from 'remix/router'
import { clientAddressOf } from '../../../client-address.ts'
import { logAction } from '../../../data/audit-log.ts'
import { deleteUserSessions } from '../../../data/sessions.ts'
import { closeUserTokens, consumeSignInToken, isTokenUsable } from '../../../data/sign-in-tokens.ts'
import { findUserById, setPasswordHash, syncPlatformAdmin } from '../../../data/users.ts'
import { sendSafely } from '../../../mail/mailer.ts'
import { passwordChangedMail } from '../../../mail/messages.ts'
import { signedInStatuses } from '../../../middleware/current-user.ts'
import { hashPassword, passwordProblem } from '../../../passwords.ts'
import { hitFormFromClient } from '../../../rate-limits.ts'
import { routes } from '../../../routes.ts'
import type { FieldErrors } from '../../../ui/form.tsx'
import { formValue } from '../../../validation.ts'
import { tooManyRequests } from '../../guards.tsx'
import { startSession } from '../../sign-in/session.ts'
import { PasswordChoosePage, PasswordLinkInvalidPage } from '../password-pages.tsx'

/**
 * The e-mailed password link (US-0.10.8): GET shows the form without using the link, POST checks
 * the password, uses the link, closes every other session and signs in here.
 */
export default createController(routes.password.choose, {
  actions: {
    async index(context) {
      const { token } = context.params
      if (!(await isTokenUsable(context.db, token, 'password_reset'))) {
        return context.render(<PasswordLinkInvalidPage />, { status: 400 })
      }
      return context.render(<PasswordChoosePage csrfToken={getCsrfToken(context)} token={token} />)
    },

    async action(context) {
      const { db, mailer, settings, background } = context
      const { token } = context.params
      const password = formValue(context.formData, 'password')
      const errors: FieldErrors = {}
      const problem = passwordProblem(password)
      if (problem !== null) errors.password = problem
      else if (formValue(context.formData, 'confirmation') !== password) {
        errors.confirmation = 'Les deux mots de passe ne sont pas les mêmes.'
      }
      if (Object.keys(errors).length > 0) {
        return context.render(
          <PasswordChoosePage csrfToken={getCsrfToken(context)} token={token} errors={errors} />,
          { status: 400 },
        )
      }

      // The hash is the costly part: only for a live link, and within the per-client limit.
      const client = await hitFormFromClient(db, settings, clientAddressOf(context.request))
      if (!client.allowed) return tooManyRequests(context, client.retryAfterSeconds)
      if (!(await isTokenUsable(db, token, 'password_reset'))) {
        return context.render(<PasswordLinkInvalidPage />, { status: 400 })
      }
      // Hash before using the link up, so that it stays usable if hashing fails.
      const hash = await hashPassword(password)
      const userId = await consumeSignInToken(db, token, 'password_reset')
      let user = userId === null ? null : await findUserById(db, userId)
      if (user !== null) user = await syncPlatformAdmin(db, user, settings.adminEmails)
      if (user === null || !signedInStatuses.has(user.status)) {
        return context.render(<PasswordLinkInvalidPage />, { status: 400 })
      }

      const { id, email } = user
      await db.transaction(async (tx) => {
        await setPasswordHash(tx, id, hash)
        // Every e-mailed link still open, to sign in or to choose a password, dies with the sessions.
        await closeUserTokens(tx, id, 'password_reset')
        await closeUserTokens(tx, id, 'sign_in')
        await deleteUserSessions(tx, id)
        await logAction(tx, {
          actorId: id,
          action: 'user.password_set',
          entity: 'user',
          entityId: id,
        })
      })
      startSession(context, id)
      const resetUrl = settings.appUrl + routes.password.request.index.href()
      background.run(() => sendSafely(mailer, passwordChangedMail(email, resetUrl)))
      return redirect(routes.home.href(), 303)
    },
  },
})
