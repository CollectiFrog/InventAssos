import { createController } from 'remix/router'

import { routes } from '../../routes.ts'
import { viewerOf } from '../viewer.ts'
import { PasswordSentPage } from './password-pages.tsx'

/** Confirmation page after a request for a password link. */
export default createController(routes.password, {
  actions: {
    sent(context) {
      return context.render(<PasswordSentPage viewer={viewerOf(context)} />)
    },
  },
})
