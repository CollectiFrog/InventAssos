import { createController } from 'remix/router'

import { routes } from '../../routes.ts'
import { SignUpSentPage } from './sign-up-page.tsx'

/** Confirmation page, identical for every outcome. */
export default createController(routes.signUp, {
  actions: {
    sent(context) {
      return context.render(<SignUpSentPage />)
    },
  },
})
