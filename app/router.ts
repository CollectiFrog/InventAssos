import { createRouter } from 'remix/router'

import controller from './actions/controller.tsx'
import healthController from './actions/health/controller.ts'
import { type AppDependencies, appMiddleware } from './middleware/index.ts'
import { routes } from './routes.ts'

/** Builds the application router. Production and tests share it; only the dependencies differ. */
export function createAppRouter(deps: AppDependencies) {
  const router = createRouter({ middleware: appMiddleware(deps) })
  router.map(routes, controller)
  router.map(routes.health, healthController)
  return router
}
