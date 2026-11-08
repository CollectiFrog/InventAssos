import type { Handle, RemixNode } from 'remix/component'

import { routes } from '../routes.ts'

/** What the header needs to know about the signed-in person; null for a visitor. */
export type Viewer = { name: string; isAdmin: boolean; csrfToken: string } | null

/** Props of the page shell. */
export interface LayoutProps {
  title: string
  viewer?: Viewer
  children?: RemixNode
}

/** The HTML document every page renders into. Server-rendered only (ADR 0015). */
export function Layout(handle: Handle<LayoutProps>) {
  return () => {
    const { title, viewer = null, children } = handle.props

    return (
      <html lang="fr">
        <head>
          <meta charSet="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <meta name="color-scheme" content="light dark" />
          <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
          <link rel="stylesheet" href="/styles.css" />
          <title>{`${title} · InventAssos`}</title>
        </head>
        <body>
          <header class="site-header">
            <a class="brand" href={routes.home.href()}>
              InventAssos
            </a>
            <nav aria-label="Compte" class="account-nav">
              {viewer ? (
                <>
                  <a href={routes.collectifs.index.href()}>Collectifs</a>
                  {viewer.isAdmin ? <a href={routes.admin.index.href()}>Administration</a> : null}
                  <a class="viewer" href={routes.account.profile.index.href()}>
                    {viewer.name}
                    {viewer.isAdmin ? <span class="badge">admin</span> : null}
                  </a>
                  <form method="post" action={routes.signOut.href()}>
                    <input type="hidden" name="_csrf" value={viewer.csrfToken} />
                    <button type="submit" class="secondary">
                      Se déconnecter
                    </button>
                  </form>
                </>
              ) : (
                <>
                  <a href={routes.signIn.form.index.href()}>Se connecter</a>
                  <a href={routes.signUp.form.index.href()}>Créer un compte</a>
                </>
              )}
            </nav>
          </header>
          <main>{children}</main>
        </body>
      </html>
    )
  }
}
