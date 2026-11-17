import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { parseTheme, themeCookie, themeFromCookieHeader } from './theme.ts'

describe('theme cookie (ADR 0032)', () => {
  it('keeps light and dark, and reads anything else as system', () => {
    assert.equal(parseTheme('light'), 'light')
    assert.equal(parseTheme('dark'), 'dark')
    assert.equal(parseTheme('neon'), 'system')
    assert.equal(parseTheme(''), 'system')
    assert.equal(parseTheme(null), 'system')
  })

  it('finds the theme among the other cookies of the request', () => {
    assert.equal(themeFromCookieHeader('a=1; assomatos_theme=dark; b=2'), 'dark')
    assert.equal(themeFromCookieHeader('assomatos_theme=<script>'), 'system')
    assert.equal(themeFromCookieHeader('other=dark'), 'system')
    assert.equal(themeFromCookieHeader(null), 'system')
  })

  it('stores a choice for a year, HTTP only, Secure behind https', () => {
    const cookie = themeCookie('light', { secure: true })
    assert.match(cookie, /^assomatos_theme=light; Max-Age=31536000;/)
    assert.match(cookie, /HttpOnly/)
    assert.match(cookie, /Secure/)
    assert.doesNotMatch(themeCookie('dark', { secure: false }), /Secure/)
  })

  it('clears the cookie when the person goes back to system', () => {
    assert.match(themeCookie('system', { secure: false }), /^assomatos_theme=; Max-Age=0;/)
  })
})
