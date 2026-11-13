import { redirect } from 'remix/response/redirect'
import { createController } from 'remix/router'

import { consumeSignInToken } from '../../data/sign-in-tokens.ts'
import { findUserById, syncPlatformAdmin } from '../../data/users.ts'
import { sessionUserKey, signedInStatuses } from '../../middleware/current-user.ts'
import { routes } from '../../routes.ts'
import { returnParam, safeReturnPath } from '../return-path.ts'
import { SignInLinkInvalidPage, SignInSentPage } from './sign-in-pages.tsx'

/** Confirmation page after a link request, and the link from the e-mail. */
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
      const { db, session, settings } = context
      const userId = await consumeSignInToken(db, context.params.token)
      let user = userId === null ? null : await findUserById(db, userId)
      if (user !== null) user = await syncPlatformAdmin(db, user, settings.adminEmails)
      if (user === null || !signedInStatuses.has(user.status)) {
        return context.render(<SignInLinkInvalidPage />, { status: 400 })
      }

      // Nothing from before sign-in survives: new ID (old row deleted) against session fixation,
      // and a new CSRF token at the next form, so a planted token is useless.
      for (const key of Object.keys(session.data[0])) session.unset(key)
      session.regenerateId(true)
      session.set(sessionUserKey, user.id)
      // US-0.7.8: back to the page asked for before signing in, if it is one of ours.
      const returnPath = safeReturnPath(context.url.searchParams.get(returnParam))
      return redirect(returnPath ?? routes.home.href(), 303)
    },
  },
})
