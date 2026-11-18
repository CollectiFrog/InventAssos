// Light, dark or system theme (ADR 0032). The choice lives in a cookie, so the server renders the
// right theme on the first byte: no flash, no JavaScript.

/** The theme a person chose; `system` follows the device. */
export type Theme = 'light' | 'dark' | 'system'

/** Every choice, in the order the switch shows them. */
export const themes: readonly Theme[] = ['system', 'light', 'dark']

/** French names of the choices, for labels and hints. */
export const themeLabels: Record<Theme, string> = {
  system: 'Automatique',
  light: 'Clair',
  dark: 'Sombre',
}

/** Name of the cookie holding the choice. */
export const themeCookieName = 'assomatos_theme'

/** A year: the choice is a preference, not a session. */
const maxAgeSeconds = 365 * 24 * 60 * 60

/** Reads a submitted or stored value; anything unknown is `system`. */
export function parseTheme(value: string | null | undefined): Theme {
  return value === 'light' || value === 'dark' ? value : 'system'
}

/** The theme stored in a `Cookie` request header. */
export function themeFromCookieHeader(header: string | null): Theme {
  if (!header) return 'system'
  for (const part of header.split(';')) {
    const [name, ...rest] = part.trim().split('=')
    if (name === themeCookieName) return parseTheme(rest.join('='))
  }
  return 'system'
}

/** `Set-Cookie` value storing the choice; `system` clears it. */
export function themeCookie(theme: Theme, options: { secure: boolean }): string {
  const attributes = ['Path=/', 'SameSite=Lax', 'HttpOnly']
  if (options.secure) attributes.push('Secure')
  if (theme === 'system') return [`${themeCookieName}=`, 'Max-Age=0', ...attributes].join('; ')
  return [`${themeCookieName}=${theme}`, `Max-Age=${maxAgeSeconds}`, ...attributes].join('; ')
}
