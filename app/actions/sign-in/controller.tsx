import { createController } from 'remix/router'

import { routes } from '../../routes.ts'
import { SignInSentPage } from './sign-in-pages.tsx'

/** Confirmation page after a link request. */
export default createController(routes.signIn, {
  actions: {
    sent(context) {
      return context.render(<SignInSentPage />)
    },
  },
})
