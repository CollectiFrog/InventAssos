import { getCsrfToken } from 'remix/middleware/csrf'
import { redirect } from 'remix/response/redirect'
import { createController } from 'remix/router'

import { consumeSignInToken } from '../../../data/sign-in-tokens.ts'
import { findUserById, syncPlatformAdmin } from '../../../data/users.ts'
import { sessionUserKey, signedInStatuses } from '../../../middleware/current-user.ts'
import { routes } from '../../../routes.ts'
import { SignInLinkInvalidPage, SignInLinkPage } from '../sign-in-pages.tsx'

/** The link from the e-mail: GET asks for confirmation, POST signs in. */
export default createController(routes.signIn.link, {
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
      if (user === null || !signedInStatuses.has(user.status)) {
        return context.render(<SignInLinkInvalidPage />, { status: 400 })
      }

      // Nothing from before sign-in survives: new ID (old row deleted) against session fixation,
      // and a new CSRF token at the next form, so a planted token is useless.
      for (const key of Object.keys(session.data[0])) session.unset(key)
      session.regenerateId(true)
      session.set(sessionUserKey, user.id)
      return redirect(routes.home.href(), 303)
    },
  },
})
