import { redirect } from 'remix/response/redirect'
import type { Middleware } from 'remix/router'

import { routes } from '../routes.ts'
import { CurrentUserKey } from './current-user.ts'

// Paths a signed-in but not yet active user may reach (permissions.md: status page and sign-out).
const openPaths = new Set([
  routes.account.status.href(),
  routes.account.reapply.href(),
  routes.signOut.href(),
  routes.health.live.href(),
  routes.health.ready.href(),
])
// Signing in again with another link must keep working.
const openPrefix = routes.signIn.form.index.href()

/** Sends pending and rejected users to their status page from anywhere else (US-0.2.3). */
export function gateInactiveAccounts(): Middleware {
  return (context, next) => {
    const user = context.get(CurrentUserKey)
    if (user == null || user.status === 'active') return next()

    const path = context.url.pathname
    if (openPaths.has(path) || path.startsWith(openPrefix)) return next()
    return redirect(routes.account.status.href(), 303)
  }
}
