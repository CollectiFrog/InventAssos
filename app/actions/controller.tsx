import { redirect } from 'remix/response/redirect'
import { createController } from 'remix/router'

import { listPendingCollectifs } from '../data/collectifs.ts'
import { pingDatabase } from '../data/health.ts'
import { countItemsOwnedBy, listRecentItems } from '../data/items.ts'
import { listPendingResponsibles } from '../data/members.ts'
import { listPendingUsers } from '../data/users.ts'
import { canReviewAccounts, isValidatedUser, itemScopeOf } from '../permissions.ts'
import { routes } from '../routes.ts'
import { parseTheme, themeCookie } from '../theme.ts'
import { formValue } from '../validation.ts'
import { backHref } from './back-link.ts'
import { DesignPreviewPage } from './design-preview-page.tsx'
import { notFound, requireUser } from './guards.tsx'
import { type Dashboard, HomePage } from './home-page.tsx'
import { viewerOf } from './viewer.ts'

/** How many recent items the dashboard lists. */
export const recentItemCount = 8

export default createController(routes, {
  actions: {
    // Visitors get the presentation; validated users their dashboard (US-0.7.2).
    async home(context) {
      const { db } = context
      const actor = context.currentUser
      let dashboard: Dashboard | undefined
      if (isValidatedUser(actor)) {
        const counts = await countItemsOwnedBy(db, [...actor.memberCollectifIds])
        dashboard = {
          collectifs: actor.collectifs.map((c) => ({ ...c, itemCount: counts.get(c.id) ?? 0 })),
          recent: await listRecentItems(db, itemScopeOf(actor), recentItemCount),
          pending: canReviewAccounts(actor)
            ? {
                accounts: (await listPendingUsers(db)).length,
                collectifs: (await listPendingCollectifs(db)).length,
                responsibles: (await listPendingResponsibles(db)).length,
              }
            : undefined,
        }
      }
      const databaseOk = dashboard ? true : await pingDatabase(db)
      return context.render(
        <HomePage
          databaseOk={databaseOk}
          viewer={viewerOf(context)}
          dashboard={dashboard}
          signedOut={context.url.searchParams.get('deconnexion') === 'ok' && actor === null}
        />,
      )
    },
    // US-0.2.8: deletes the session row, so the old cookie is worthless even if it was copied.
    signOut(context) {
      context.session.destroy()
      // The session is gone, so no flash message: the home page reads this flag (US-0.7.7).
      return redirect(`${routes.home.href()}?deconnexion=ok`, 303)
    },
    // ADR 0032: a cookie on this device, then back to the page the switch was on.
    appearance(context) {
      const actor = requireUser(context)
      if (actor instanceof Response) return actor
      const theme = parseTheme(formValue(context.formData, 'theme'))
      const secure = new URL(context.settings.appUrl).protocol === 'https:'
      const response = redirect(backHref(context, routes.home.href()), 303)
      response.headers.append('Set-Cookie', themeCookie(theme, { secure }))
      return response
    },
    // Tokens and components in both themes, for design reviews; not served in production.
    designPreview(context) {
      if (context.settings.production) return notFound(context)
      const asked = context.url.searchParams.get('theme')
      const theme = asked === 'light' || asked === 'dark' ? asked : undefined
      return context.render(<DesignPreviewPage viewer={viewerOf(context)} theme={theme} />)
    },
  },
})
