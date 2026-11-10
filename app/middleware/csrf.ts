import { csrf } from 'remix/middleware/csrf'
import type { Middleware } from 'remix/router'

const safeMethods = new Set(['GET', 'HEAD', 'OPTIONS'])

/**
 * CSRF checks for unsafe methods only. `csrf()` alone creates a token, hence a stored session,
 * on every GET, including health probes; pages with a form call `getCsrfToken()` themselves.
 */
export function checkCsrf(publicOrigin: string): Middleware {
  const check = csrf({ origin: publicOrigin })
  return (context, next) =>
    safeMethods.has(context.request.method.toUpperCase()) ? next() : check(context, next)
}
