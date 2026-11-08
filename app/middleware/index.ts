import { createCookie } from 'remix/cookie'
import type { Database } from 'remix/data-table'
import { formData } from 'remix/middleware/form-data'
import { render } from 'remix/middleware/render'
import { session } from 'remix/middleware/session'
import { staticFiles } from 'remix/middleware/static'
import { createMiddleware, type MiddlewareContext } from 'remix/router'

import { createPostgresSessionStorage, sessionMaxAgeSeconds } from '../data/sessions.ts'
import type { Mailer } from '../mail/mailer.ts'
import { checkCsrf } from './csrf.ts'
import { provideDatabase } from './database.ts'
import { type AppSettings, provideMailer, provideSettings } from './services.ts'

/** Services the router needs; tests pass their own. */
export interface AppDependencies {
  db: Database
  mailer: Mailer
  settings: AppSettings
  sessionSecret: string
}

/** The router middleware chain, in order. Kept apart from the router so its type has no cycle. */
export function appMiddleware(deps: AppDependencies) {
  const appUrl = new URL(deps.settings.appUrl)
  const sessionCookie = createCookie('inventassos_session', {
    secrets: [deps.sessionSecret],
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: sessionMaxAgeSeconds,
    // TLS ends at the ingress, so the request URL says http: trust APP_URL instead.
    secure: appUrl.protocol === 'https:',
  })

  return createMiddleware(
    staticFiles('./public', { index: false }),
    provideDatabase(deps.db),
    provideMailer(deps.mailer),
    provideSettings(deps.settings),
    session(sessionCookie, createPostgresSessionStorage(deps.db)),
    formData(),
    // Same reason as `secure`: compare form posts with the public origin, not the pod's URL.
    checkCsrf(appUrl.origin),
    render(),
  )
}

/** Request context seen by every action. */
export type AppContext = MiddlewareContext<ReturnType<typeof appMiddleware>>

declare module 'remix' {
  interface RouterTypes {
    context: AppContext
  }
}
