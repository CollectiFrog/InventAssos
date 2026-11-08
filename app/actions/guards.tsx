import { redirect } from 'remix/response/redirect'

import type { CurrentUser } from '../middleware/current-user.ts'
import type { AppContext } from '../middleware/index.ts'
import { routes } from '../routes.ts'
import { Layout } from '../ui/layout.tsx'
import { viewerOf } from './viewer.ts'

/** Returns the signed-in user, or a redirect to the sign-in page for a visitor. */
export function requireUser(context: AppContext): CurrentUser | Response {
  return context.currentUser ?? redirect(routes.signIn.form.index.href(), 303)
}

/** 403 page for an action the permissions table does not allow. */
export function forbidden(context: AppContext): Response | Promise<Response> {
  return context.render(
    <Layout title="Accès refusé" viewer={viewerOf(context)}>
      <h1>Accès refusé</h1>
      <p>Vous n’avez pas les droits nécessaires pour cette action.</p>
      <p>
        <a href={routes.home.href()}>Retour à l’accueil</a>
      </p>
    </Layout>,
    { status: 403 },
  )
}

/** 404 page. */
export function notFound(context: AppContext): Response | Promise<Response> {
  return context.render(
    <Layout title="Introuvable" viewer={viewerOf(context)}>
      <h1>Page introuvable</h1>
      <p>
        <a href={routes.home.href()}>Retour à l’accueil</a>
      </p>
    </Layout>,
    { status: 404 },
  )
}
