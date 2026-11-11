// US-0.7.8: where to land after signing in. Only a path of this site is ever followed, so a
// crafted link cannot send someone elsewhere (no open redirect).

/** Query parameter that carries the requested page through the sign-in flow. */
export const returnParam = 'suite'

/** Pages that make no sense to come back to after signing in. */
const excluded = ['/connexion', '/inscription', '/deconnexion']

/** The value as an internal path ("/materiel?x=1"), or null when it is not a safe one. */
export function safeReturnPath(value: string | null | undefined): string | null {
  if (!value || value.length > 500 || !value.startsWith('/')) return null
  // "//host" and "/\host" are read by browsers as another site.
  if (value.startsWith('//') || value.includes('\\') || /\s/.test(value)) return null
  if ([...value].some((char) => char.charCodeAt(0) < 0x20)) return null
  const base = 'http://inventassos.invalid'
  let url: URL
  try {
    url = new URL(value, base)
  } catch {
    return null
  }
  if (url.origin !== base) return null
  if (excluded.some((path) => url.pathname === path || url.pathname.startsWith(`${path}/`))) {
    return null
  }
  return url.pathname + url.search
}

/** `href` with the return path added as `?suite=`, or unchanged when there is none. */
export function withReturnPath(href: string, path: string | null): string {
  if (path === null) return href
  const separator = href.includes('?') ? '&' : '?'
  return `${href}${separator}${returnParam}=${encodeURIComponent(path)}`
}
