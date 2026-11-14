import type { Handle } from 'remix/component'

import { routes } from '../../routes.ts'
import type { Crumb, Viewer } from '../../ui/layout.tsx'
import { Tabs } from '../../ui/tabs.tsx'

/** A section of Administration. */
export type AdminSection = 'requests' | 'accounts' | 'collectifs' | 'team' | 'categories'

/** Administration is reached from Mon compte (ADR 0030): « Retour » and the breadcrumb lead there. */
export const adminBack = `${routes.account.profile.index.href()}#administration`
export const adminTrail: Crumb[] = [
  { label: 'Mon compte', href: adminBack },
  { label: 'Administration' },
]

/** Sections of Administration, each at its own URL (ADR 0022); Équipe is for admins only. */
export function AdminTabs(handle: Handle<{ current: AdminSection; viewer: Viewer }>) {
  return () => {
    const { current, viewer } = handle.props
    const sections = [
      { key: 'requests', label: 'Demandes', href: routes.admin.requests.href() },
      { key: 'accounts', label: 'Comptes', href: routes.admin.accounts.href() },
      { key: 'collectifs', label: 'Collectifs', href: routes.admin.collectifs.index.href() },
      ...(viewer?.isAdmin
        ? [{ key: 'team', label: 'Équipe', href: routes.admin.team.index.href() }]
        : []),
      { key: 'categories', label: 'Catégories', href: routes.admin.categories.index.href() },
    ]
    return (
      <Tabs
        label="Administration"
        tabs={sections.map(({ key, ...tab }) => ({ ...tab, current: key === current }))}
      />
    )
  }
}
