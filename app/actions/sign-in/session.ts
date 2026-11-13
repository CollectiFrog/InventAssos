// Starting a signed-in session, shared by the e-mailed link, the password and a new password.

import { sessionUserKey } from '../../middleware/current-user.ts'
import type { AppContext } from '../../middleware/index.ts'

/**
 * Signs `userId` in on this client. Nothing from before survives: new ID (old row deleted) against
 * session fixation, and a new CSRF token at the next form, so a planted token is useless.
 */
export function startSession(context: AppContext, userId: string): void {
  const { session } = context
  for (const key of Object.keys(session.data[0])) session.unset(key)
  session.regenerateId(true)
  session.set(sessionUserKey, userId)
}
