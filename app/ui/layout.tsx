import type { Handle, RemixNode } from 'remix/component'

import { routes } from '../routes.ts'

/** What the header needs to know about the signed-in person; null for a visitor. */
export type Viewer = {
  name: string
  isAdmin: boolean
  /** Only active accounts get the navigation; pending and rejected ones see their status page. */
  isActive: boolean
  csrfToken: string
} | null

/** The four navigation entries (US-0.7.1); a page names the one it belongs to. */
export type Section = 'home' | 'search' | 'mine' | 'collectifs'

/** Props of the page shell. */
export interface LayoutProps {
  title: string
  viewer?: Viewer
  /** Navigation entry marked as current; detail pages reached from several places leave it out. */
  section?: Section
  /** Header link marked as current, for the pages reached from the header. */
  headerLink?: 'admin' | 'account'
  children?: RemixNode
}

/** Up to two initials for the account button: "Camille Martin" → "CM". */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  const letters = words.length > 1 ? [words[0], words.at(-1)] : words
  return letters.map((word = '') => word.charAt(0).toLocaleUpperCase('fr')).join('')
}

const entries: { section: Section; label: string; href: string; icon: RemixNode }[] = [
  {
    section: 'home',
    label: 'Accueil',
    href: routes.home.href(),
    icon: <path d="M4 11l8-7 8 7v9h-5v-6h-6v6H4z" />,
  },
  {
    section: 'search',
    label: 'Rechercher',
    href: routes.inventory.index.href(),
    icon: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="M20 20l-3.5-3.5" />
      </>
    ),
  },
  {
    section: 'mine',
    label: 'Mon matériel',
    href: routes.items.index.href(),
    icon: (
      <>
        <path d="M3 8l9-5 9 5v8l-9 5-9-5z" />
        <path d="M3 8l9 5 9-5M12 13v8" />
      </>
    ),
  },
  {
    section: 'collectifs',
    label: 'Collectifs',
    href: routes.collectifs.index.href(),
    icon: (
      <>
        <circle cx="9" cy="8" r="3.5" />
        <path d="M2.5 20c.5-3.5 3.2-5.5 6.5-5.5s6 2 6.5 5.5" />
        <circle cx="17" cy="9" r="2.5" />
        <path d="M17 14.5c2.4 0 4.2 1.6 4.5 4.5" />
      </>
    ),
  },
]

/** The HTML document every page renders into. Server-rendered only (ADR 0015). */
export function Layout(handle: Handle<LayoutProps>) {
  return () => {
    const { title, viewer = null, section, headerLink, children } = handle.props
    const navigates = viewer?.isActive === true

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
        <body class={navigates ? 'has-nav' : undefined}>
          <header class="site-header">
            <a class="brand" href={routes.home.href()}>
              InventAssos
            </a>
            {navigates ? (
              // One nav for both layouts: styles.css moves it to a bottom tab bar below 720 px.
              <nav aria-label="Navigation principale" class="main-nav">
                {entries.map((entry) => (
                  <a
                    href={entry.href}
                    aria-current={entry.section === section ? 'page' : undefined}
                  >
                    <svg
                      width="22"
                      height="22"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      aria-hidden="true"
                    >
                      {entry.icon}
                    </svg>
                    <span>{entry.label}</span>
                  </a>
                ))}
              </nav>
            ) : null}
            <div class="header-links">
              {viewer && navigates ? (
                <>
                  {viewer.isAdmin ? (
                    <a
                      href={routes.admin.index.href()}
                      aria-current={headerLink === 'admin' ? 'page' : undefined}
                    >
                      Administration
                    </a>
                  ) : null}
                  <a
                    class="avatar"
                    href={routes.account.profile.index.href()}
                    aria-label={`Mon compte : ${viewer.name}`}
                    aria-current={headerLink === 'account' ? 'page' : undefined}
                  >
                    {initialsOf(viewer.name)}
                  </a>
                </>
              ) : viewer ? (
                <SignOutButton csrfToken={viewer.csrfToken} />
              ) : (
                <>
                  <a href={routes.signIn.form.index.href()}>Se connecter</a>
                  <a href={routes.signUp.form.index.href()}>Créer un compte</a>
                </>
              )}
            </div>
          </header>
          <main>{children}</main>
        </body>
      </html>
    )
  }
}

/** Sign-out form: in the header for pending accounts, on the account page for active ones. */
export function SignOutButton(handle: Handle<{ csrfToken: string }>) {
  return () => (
    <form method="post" action={routes.signOut.href()} class="sign-out">
      <input type="hidden" name="_csrf" value={handle.props.csrfToken} />
      <button type="submit" class="secondary">
        Se déconnecter
      </button>
    </form>
  )
}
