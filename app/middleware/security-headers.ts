// Browser hardening headers on every response (review F8). The app is server-rendered without
// client JavaScript (ADR 0015), so the content policy allows no script at all.
import { csp } from 'remix/middleware/csp'
import type { Middleware } from 'remix/router'

/** One year, the usual HSTS lifetime. */
const hstsMaxAgeSeconds = 365 * 24 * 60 * 60

/** Content-Security-Policy for HTML pages: own stylesheet and favicon, forms posting to us only. */
export function contentSecurityPolicy() {
  return csp({
    policy: {
      defaultSrc: ["'none'"],
      styleSrc: ["'self'"],
      imgSrc: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      baseUri: ["'none'"],
    },
  })
}

/**
 * nosniff, no framing, same-origin referrers on every response, static files included; HSTS only
 * when the public URL is https, since TLS ends at the ingress and the pod itself speaks http.
 */
export function securityHeaders(options: { https: boolean }): Middleware {
  return async (_context, next) => {
    // A fresh Response: some responses (e.g. static files) may carry immutable headers.
    const original = await next()
    const response = new Response(original.body, original)
    response.headers.set('X-Content-Type-Options', 'nosniff')
    response.headers.set('X-Frame-Options', 'DENY')
    response.headers.set('Referrer-Policy', 'same-origin')
    if (options.https) {
      response.headers.set('Strict-Transport-Security', `max-age=${hstsMaxAgeSeconds}`)
    }
    return response
  }
}
