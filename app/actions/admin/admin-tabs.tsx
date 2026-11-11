import type { Handle } from 'remix/component'

import { routes } from '../../routes.ts'
import { Tabs } from '../../ui/tabs.tsx'

/** Sections of Administration, each at its own URL (ADR 0022); moderators join in V0.8. */
export function AdminTabs(
  handle: Handle<{ current: 'requests' | 'accounts' | 'collectifs' | 'categories' }>,
) {
  return () => {
    const sections = [
      { key: 'requests', label: 'Demandes', href: routes.admin.requests.href() },
      { key: 'accounts', label: 'Comptes', href: routes.admin.accounts.href() },
      { key: 'collectifs', label: 'Collectifs', href: routes.admin.collectifs.index.href() },
      { key: 'categories', label: 'Catégories', href: routes.admin.categories.index.href() },
    ]
    return (
      <Tabs
        label="Administration"
        tabs={sections.map(({ key, ...tab }) => ({
          ...tab,
          current: key === handle.props.current,
        }))}
      />
    )
  }
}
