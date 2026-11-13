import { redirect } from 'remix/response/redirect'

import type { CurrentUser } from '../middleware/current-user.ts'
import type { AppContext } from '../middleware/index.ts'
import { routes } from '../routes.ts'
import { Layout } from '../ui/layout.tsx'
import { safeReturnPath, withReturnPath } from './return-path.ts'
import { viewerOf } from './viewer.ts'

/**
 * Returns the signed-in user, or a redirect to the sign-in page for a visitor. A page asked for
 * with GET is remembered, to land there after signing in (US-0.7.8).
 */
export function requireUser(context: AppContext): CurrentUser | Response {
  if (context.currentUser) return context.currentUser
  const requested =
    context.request.method === 'GET'
      ? safeReturnPath(context.url.pathname + context.url.search)
      : null
  return redirect(withReturnPath(routes.signIn.form.index.href(), requested), 303)
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

/** 429 page when a rate limit is reached (ADR 0018); says nothing about why or whom. */
export function tooManyRequests(
  context: AppContext,
  retryAfterSeconds: number,
): Response | Promise<Response> {
  return context.render(
    <Layout title="Trop de demandes" viewer={viewerOf(context)}>
      <h1>Trop de demandes</h1>
      <p>Vous avez fait beaucoup de demandes en peu de temps. Réessayez un peu plus tard.</p>
      <p>
        <a href={routes.home.href()}>Retour à l’accueil</a>
      </p>
    </Layout>,
    { status: 429, headers: { 'Retry-After': String(retryAfterSeconds) } },
  )
}
