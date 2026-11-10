import { getCsrfToken } from 'remix/middleware/csrf'

import type { AppContext } from '../middleware/index.ts'
import type { Viewer } from '../ui/layout.tsx'

/** Header data for the current request. Visitors get null, so no session is created for them. */
export function viewerOf(context: AppContext): Viewer {
  const user = context.currentUser
  if (user === null) return null
  return {
    name: user.name,
    isAdmin: user.isAdmin,
    isActive: user.status === 'active',
    csrfToken: getCsrfToken(context),
  }
}
