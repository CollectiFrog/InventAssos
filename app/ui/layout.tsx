import type { Handle, RemixNode } from 'remix/component'
import { appInitials, appName } from '../brand.ts'
import { routes } from '../routes.ts'
import { Icon, icons } from './icons.tsx'

/** What the shell needs to know about the signed-in person; null for a visitor. */
export type Viewer = {
  name: string
  /** Listed in PLATFORM_ADMIN_EMAILS or named in the app: manages the team (US-0.10.7). */
  isAdmin: boolean
  /** Admin or moderator: Mon compte shows the Administration section (US-0.8.2, US-0.10.9). */
  isStaff: boolean
  /** Only active accounts get the navigation; pending and rejected ones see their status page. */
  isActive: boolean
  csrfToken: string
  /** Collectifs the person belongs to, by name, for the sidebar's "Mes collectifs". */
  collectifs: readonly { name: string; slug: string }[]
} | null

/** The four navigation entries (US-0.7.1); a page names the one it belongs to. */
export type Section = 'home' | 'search' | 'mine' | 'collectifs'

/** One step of the breadcrumb; the last one is the page itself and has no link. */
export interface Crumb {
  label: string
  href?: string
}

/** Props of the page shell. */
export interface LayoutProps {
  title: string
  viewer?: Viewer
  /** Navigation entry marked as current; detail pages reached from several places leave it out. */
  section?: Section
  /** Shell link marked as current, for the pages reached from outside the four entries. */
  headerLink?: 'account'
  /** Breadcrumb shown above the title on computers (ADR 0022). */
  trail?: Crumb[]
  /** Where « Retour » goes on phones: the previous page of this site, else the parent. */
  back?: string
  /** What the top bar's « + » adds here; equipment in general by default (ADR 0031). */
  add?: { href: string; label: string }
  children?: RemixNode
}

/** How many collectifs the sidebar lists before linking to all of them (ADR 0022). */
export const sidebarCollectifLimit = 5

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
    icon: icons.search,
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
    const { title, viewer = null, section, headerLink, trail = [], back, children } = handle.props
    const add = handle.props.add ?? {
      href: routes.items.create.index.href(),
      label: 'Ajouter du matériel',
    }
    const navigates = viewer?.isActive === true

    return (
      <html lang="fr">
        <head>
          <meta charSet="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <meta name="color-scheme" content="light dark" />
          <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
          <link rel="stylesheet" href="/styles.css" />
          <title>{`${title} · ${appName}`}</title>
        </head>
        <body class={navigates ? 'has-nav' : undefined}>
          <a class="skip-link" href="#contenu">
            Aller au contenu
          </a>
          <div class="shell">
            {viewer && navigates ? <Sidebar viewer={viewer} section={section} /> : null}
            <div class="shell-body">
              <header class="top-bar">
                <a class="brand" href={routes.home.href()}>
                  {appName}
                </a>
                {navigates ? (
                  <form method="get" action={routes.inventory.index.href()} class="top-search">
                    <label for="recherche-globale" class="visually-hidden">
                      Chercher dans mes collectifs
                    </label>
                    <input
                      type="search"
                      id="recherche-globale"
                      name="q"
                      placeholder="Chercher dans mes collectifs…"
                    />
                    <button type="submit" class="secondary icon-button" title="Rechercher">
                      <Icon name="search" />
                      <span class="visually-hidden">Rechercher</span>
                    </button>
                  </form>
                ) : null}
                <div class="header-links">
                  {viewer && navigates ? (
                    <>
                      <a class="button top-add icon-button" href={add.href} title={add.label}>
                        <Icon name="add" />
                        <span class="visually-hidden">{add.label}</span>
                      </a>
                      <a
                        class="avatar"
                        href={routes.account.profile.index.href()}
                        // The visible initials start the name, for voice control (WCAG 2.5.3).
                        aria-label={`${initialsOf(viewer.name)}, mon compte : ${viewer.name}`}
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
              <main id="contenu">
                {back || trail.length > 0 ? (
                  <div class="page-nav">
                    {back ? (
                      <a class="back-link" href={back}>
                        <span aria-hidden="true">← </span>Retour
                      </a>
                    ) : null}
                    {trail.length > 0 ? (
                      <nav aria-label="Fil d’Ariane" class="breadcrumb">
                        <ol>
                          {trail.map((crumb, index) =>
                            crumb.href && index < trail.length - 1 ? (
                              <li>
                                <a href={crumb.href} class="crumb-link">
                                  {crumb.label}
                                </a>
                              </li>
                            ) : (
                              <li aria-current="page">{crumb.label}</li>
                            ),
                          )}
                        </ol>
                      </nav>
                    ) : null}
                  </div>
                ) : null}
                {children}
              </main>
            </div>
          </div>
        </body>
      </html>
    )
  }
}

/**
 * The four entries and "Mes collectifs". styles.css makes it a bottom tab bar below 720 px, a rail
 * up to 1099 px, then a sidebar (ADR 0022); Administration lives in Mon compte (ADR 0030).
 */
function Sidebar(handle: Handle<{ viewer: NonNullable<Viewer>; section?: Section }>) {
  return () => {
    const { viewer, section } = handle.props
    const shown = viewer.collectifs.slice(0, sidebarCollectifLimit)

    return (
      <aside class="sidebar">
        <a class="brand side-brand" href={routes.home.href()}>
          <span class="logo" aria-hidden="true">
            {appInitials}
          </span>
          <span class="brand-name">{appName}</span>
        </a>
        <nav aria-label="Navigation principale" class="main-nav">
          {entries.map((entry) => (
            <a href={entry.href} aria-current={entry.section === section ? 'page' : undefined}>
              <Icon>{entry.icon}</Icon>
              <span>{entry.label}</span>
            </a>
          ))}
        </nav>
        {shown.length > 0 ? (
          <>
            <p class="side-heading" id="mes-collectifs">
              Mes collectifs
            </p>
            <nav aria-labelledby="mes-collectifs" class="my-collectifs">
              {shown.map((collectif) => (
                <a href={routes.collectifs.show.href({ slug: collectif.slug })}>
                  <span class="initials" aria-hidden="true">
                    {initialsOf(collectif.name)}
                  </span>
                  <span>{collectif.name}</span>
                </a>
              ))}
              {viewer.collectifs.length > shown.length ? (
                <a href={routes.collectifs.index.href()}>
                  <span class="initials" aria-hidden="true">
                    …
                  </span>
                  <span>Tous</span>
                </a>
              ) : null}
            </nav>
          </>
        ) : null}
      </aside>
    )
  }
}

/** Sign-out form: in the top bar for pending accounts, on the account page for active ones. */
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
