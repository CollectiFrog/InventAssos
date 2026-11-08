import type { Handle, RemixNode } from 'remix/component'

import { routes } from '../routes.ts'

/** Props of the page shell. */
export interface LayoutProps {
  title: string
  children?: RemixNode
}

/** The HTML document every page renders into. Server-rendered only: no client script yet. */
export function Layout(handle: Handle<LayoutProps>) {
  return () => {
    const { title, children } = handle.props

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
          </header>
          <main>{children}</main>
        </body>
      </html>
    )
  }
}
