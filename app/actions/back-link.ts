// ui.md « Retour »: back one page using the Referer header (sent for same-origin navigation only,
// Referrer-Policy: same-origin), never off the site; the section's list page otherwise.
import type { AppContext } from '../middleware/index.ts'
import { safeReturnPath } from './return-path.ts'

/** The previous page of this site when the browser says so, else `fallback`. */
export function backHref(context: AppContext, fallback: string): string {
  const referer = context.request.headers.get('Referer')
  if (!referer) return fallback
  let url: URL
  try {
    url = new URL(referer)
  } catch {
    return fallback
  }
  // TLS ends at the ingress: the public origin is APP_URL's, not always the request's.
  const ours = new Set([context.url.origin, new URL(context.settings.appUrl).origin])
  if (!ours.has(url.origin) || url.pathname === context.url.pathname) return fallback
  return safeReturnPath(url.pathname + url.search) ?? fallback
}
