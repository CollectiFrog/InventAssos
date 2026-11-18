import type { Handle, RemixNode } from 'remix/component'
import { appInitials, appName } from '../brand.ts'
import { routes } from '../routes.ts'
import { type Theme, themeLabels, themes } from '../theme.ts'
import { Icon, type IconName } from './icons.tsx'

/** What the shell needs to know about the signed-in person; null for a visitor. */
export type Viewer = {
  name: string
  /** Listed in PLATFORM_ADMIN_EMAILS or named in the app: manages the team (US-0.10.7). */
  isAdmin: boolean
  /** Admin or moderator: the navigation shows Administration (US-0.8.2, ADR 0033). */
  isStaff: boolean
  /** Only active accounts get the navigation; pending and rejected ones see their status page. */
  isActive: boolean
  csrfToken: string
  /** Collectifs the person belongs to, by name, for the sidebar's "Mes collectifs". */
  collectifs: readonly { name: string; slug: string }[]
  /** Light, dark or system, from the theme cookie (ADR 0032). */
  theme: Theme
} | null

/** The navigation entries (US-0.7.1), plus Administration for staff; a page names its own. */
export type Section = 'home' | 'search' | 'mine' | 'collectifs' | 'admin'

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
  /** Forces a theme over the viewer's choice: the design preview's `?theme=` (ADR 0032). */
  theme?: Theme
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

const entries: { section: Section; label: string; href: string; icon: IconName }[] = [
  { section: 'home', label: 'Accueil', href: routes.home.href(), icon: 'home' },
  { section: 'search', label: 'Rechercher', href: routes.inventory.index.href(), icon: 'search' },
  { section: 'mine', label: 'Mon matériel', href: routes.items.index.href(), icon: 'equipment' },
  {
    section: 'collectifs',
    label: 'Collectifs',
    href: routes.collectifs.index.href(),
    icon: 'people',
  },
]

/**
 * The fifth entry, for admins and moderators only (ADR 0033). A soft hyphen lets the label break
 * in the 72 px rail and the phone's tab bar, where « Administration » is wider than its column.
 */
const adminEntry = {
  section: 'admin',
  label: 'Adminis\u00adtration',
  href: routes.admin.index.href(),
  icon: 'admin',
} as const

/** The HTML document every page renders into. Server-rendered only (ADR 0015). */
export function Layout(handle: Handle<LayoutProps>) {
  return () => {
    const { title, viewer = null, section, headerLink, trail = [], back, children } = handle.props
    const navigates = viewer?.isActive === true
    const theme = handle.props.theme ?? viewer?.theme ?? 'system'

    return (
      <html lang="fr" data-theme={theme === 'system' ? undefined : theme}>
        <head>
          <meta charSet="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <meta name="color-scheme" content={theme === 'system' ? 'light dark' : theme} />
          <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
          <link
            rel="preload"
            href="/fonts/inter-latin-opsz-normal.woff2"
            as="font"
            type="font/woff2"
            crossOrigin="anonymous"
          />
          <link rel="stylesheet" href="/tokens.css" />
          <link rel="stylesheet" href="/styles.css" />
          <title>{`${title} · ${appName}`}</title>
        </head>
        <body class={navigates ? 'has-nav' : undefined}>
          <a class="skip-link" href="#contenu">
            Aller au contenu
          </a>
          <div class="shell">
            {viewer && navigates ? (
              <Sidebar viewer={viewer} section={section} onAccount={headerLink === 'account'} />
            ) : null}
            <div class="shell-body">
              <header class="top-bar">
                <a class="brand" href={routes.home.href()}>
                  {appName}
                </a>
                <div class="header-links">
                  {viewer && navigates ? (
                    // Phones only: computers have no top bar, Mon compte is in the sidebar (ADR 0037).
                    <a
                      class="avatar"
                      href={routes.account.profile.index.href()}
                      // The visible initials start the name, for voice control (WCAG 2.5.3).
                      aria-label={`${initialsOf(viewer.name)}, mon compte : ${viewer.name}`}
                      aria-current={headerLink === 'account' ? 'page' : undefined}
                    >
                      {initialsOf(viewer.name)}
                    </a>
                  ) : viewer ? (
                    <SignOutButton csrfToken={viewer.csrfToken} />
                  ) : // Visitors: every page they reach links sign-in and sign-up itself (US-0.10.17).
                  null}
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
 * The four entries, Administration for staff, "Mes collectifs", then the theme and Mon compte at
 * the foot. styles.css makes it a bottom tab bar below 720 px (the foot hidden: the account stays
 * in the top bar), a rail up to 1099 px, then a sidebar (ADR 0022, ADR 0033, ADR 0034).
 */
function Sidebar(
  handle: Handle<{ viewer: NonNullable<Viewer>; section?: Section; onAccount?: boolean }>,
) {
  return () => {
    const { viewer, section, onAccount } = handle.props
    const shown = viewer.collectifs.slice(0, sidebarCollectifLimit)
    const links = viewer.isStaff ? [...entries, adminEntry] : entries

    return (
      <aside class="sidebar">
        <a class="brand side-brand" href={routes.home.href()}>
          <span class="logo" aria-hidden="true">
            {appInitials}
          </span>
          <span class="brand-name">{appName}</span>
        </a>
        <nav aria-label="Navigation principale" class="main-nav">
          {links.map((entry) => (
            <a href={entry.href} aria-current={entry.section === section ? 'page' : undefined}>
              <Icon name={entry.icon} />
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
        <div class="side-foot">
          <div class="theme-switch">
            <ThemeSwitch csrfToken={viewer.csrfToken} theme={viewer.theme} compact />
          </div>
          <a
            class="side-account"
            href={routes.account.profile.index.href()}
            title={viewer.name}
            aria-current={onAccount ? 'page' : undefined}
          >
            <span class="initials" aria-hidden="true">
              {initialsOf(viewer.name)}
            </span>
            <span>Mon compte</span>
          </a>
        </div>
      </aside>
    )
  }
}

/** Sign-out form: in the top bar for pending accounts, on the account page for active ones. */
export function SignOutButton(handle: Handle<{ csrfToken: string; small?: boolean }>) {
  return () => (
    <form method="post" action={routes.signOut.href()} class="sign-out">
      <input type="hidden" name="_csrf" value={handle.props.csrfToken} />
      <button type="submit" class={handle.props.small ? 'secondary small' : 'secondary'}>
        Se déconnecter
      </button>
    </form>
  )
}

const themeIcons: Record<Theme, IconName> = { system: 'system', light: 'light', dark: 'dark' }

/**
 * Automatique / Clair / Sombre: one form, one button per choice, the current one pressed. The
 * server stores the choice in a cookie and sends the person back (ADR 0032). `compact` shows icons.
 */
export function ThemeSwitch(
  handle: Handle<{ csrfToken: string; theme: Theme; compact?: boolean }>,
) {
  return () => {
    const { csrfToken, theme, compact } = handle.props
    return (
      <form
        method="post"
        action={routes.appearance.href()}
        class={compact ? undefined : 'theme-choice'}
        aria-label="Thème"
      >
        <input type="hidden" name="_csrf" value={csrfToken} />
        {themes.map((choice) => (
          <button
            type="submit"
            name="theme"
            value={choice}
            aria-pressed={choice === theme ? 'true' : 'false'}
            title={compact ? `Thème : ${themeLabels[choice].toLowerCase()}` : undefined}
          >
            {compact ? (
              <>
                <Icon name={themeIcons[choice]} size={14} />
                <span class="visually-hidden">{`Thème ${themeLabels[choice].toLowerCase()}`}</span>
              </>
            ) : (
              themeLabels[choice]
            )}
          </button>
        ))}
      </form>
    )
  }
}
