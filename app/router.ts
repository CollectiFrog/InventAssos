import { createRouter } from 'remix/router'

import accountController from './actions/account/controller.tsx'
import profileController from './actions/account/profile/controller.tsx'
import adminCollectifsController from './actions/admin/collectifs/controller.tsx'
import adminController from './actions/admin/controller.tsx'
import adminResponsiblesController from './actions/admin/responsibles/controller.tsx'
import collectifsController from './actions/collectifs/controller.tsx'
import editCollectifController from './actions/collectifs/edit/controller.tsx'
import requestCollectifController from './actions/collectifs/request/controller.tsx'
import controller from './actions/controller.tsx'
import healthController from './actions/health/controller.ts'
import itemsController from './actions/items/controller.tsx'
import createItemController from './actions/items/create/controller.tsx'
import editItemController from './actions/items/edit/controller.tsx'
import locationsController from './actions/locations/controller.tsx'
import createLocationController from './actions/locations/create/controller.tsx'
import editLocationController from './actions/locations/edit/controller.tsx'
import signInController from './actions/sign-in/controller.tsx'
import signInFormController from './actions/sign-in/form/controller.tsx'
import signInLinkController from './actions/sign-in/link/controller.tsx'
import signUpController from './actions/sign-up/controller.tsx'
import signUpFormController from './actions/sign-up/form/controller.tsx'
import { type AppDependencies, appMiddleware } from './middleware/index.ts'
import { routes } from './routes.ts'

/** Builds the application router. Production and tests share it; only the dependencies differ. */
export function createAppRouter(deps: AppDependencies) {
  const router = createRouter({ middleware: appMiddleware(deps) })
  router.map(routes, controller)
  router.map(routes.account, accountController)
  router.map(routes.account.profile, profileController)
  router.map(routes.admin, adminController)
  router.map(routes.admin.collectifs, adminCollectifsController)
  router.map(routes.admin.responsibles, adminResponsiblesController)
  router.map(routes.collectifs, collectifsController)
  router.map(routes.collectifs.request, requestCollectifController)
  router.map(routes.collectifs.edit, editCollectifController)
  router.map(routes.health, healthController)
  router.map(routes.items, itemsController)
  router.map(routes.items.create, createItemController)
  router.map(routes.items.edit, editItemController)
  router.map(routes.locations, locationsController)
  router.map(routes.locations.create, createLocationController)
  router.map(routes.locations.edit, editLocationController)
  router.map(routes.signIn, signInController)
  router.map(routes.signIn.form, signInFormController)
  router.map(routes.signIn.link, signInLinkController)
  router.map(routes.signUp, signUpController)
  router.map(routes.signUp.form, signUpFormController)
  return router
}
