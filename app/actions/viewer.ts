import { getCsrfToken } from 'remix/middleware/csrf'

import type { AppContext } from '../middleware/index.ts'
import { isActiveAdmin, isActiveStaff } from '../permissions.ts'
import type { Viewer } from '../ui/layout.tsx'

/** Shell data for the current request. Visitors get null, so no session is created for them. */
export function viewerOf(context: AppContext): Viewer {
  const user = context.currentUser
  if (user === null) return null
  return {
    name: user.name,
    isAdmin: isActiveAdmin(user),
    isStaff: isActiveStaff(user),
    isActive: user.status === 'active',
    csrfToken: getCsrfToken(context),
    collectifs: user.collectifs.map(({ name, slug }) => ({ name, slug })),
  }
}
