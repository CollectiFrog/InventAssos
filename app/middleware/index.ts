import type { Database } from 'remix/data-table'
import { render } from 'remix/middleware/render'
import { staticFiles } from 'remix/middleware/static'
import { createMiddleware, type MiddlewareContext } from 'remix/router'

import { provideDatabase } from './database.ts'

/** Services the router needs; tests pass their own. */
export interface AppDependencies {
  db: Database
}

/** The router middleware chain, in order. Kept apart from the router so its type has no cycle. */
export function appMiddleware(deps: AppDependencies) {
  return createMiddleware(
    staticFiles('./public', { index: false }),
    provideDatabase(deps.db),
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
