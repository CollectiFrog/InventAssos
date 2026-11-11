import type { Handle } from 'remix/component'

import { routes } from '../../routes.ts'
import { Tabs } from '../../ui/tabs.tsx'

/** Sections of Administration, each at its own URL (ADR 0022); more join with US-0.7.13. */
export function AdminTabs(handle: Handle<{ current: 'requests' | 'categories' }>) {
  return () => (
    <Tabs
      label="Administration"
      tabs={[
        {
          label: 'Demandes',
          href: routes.admin.index.href(),
          current: handle.props.current === 'requests',
        },
        {
          label: 'Catégories',
          href: routes.admin.categories.index.href(),
          current: handle.props.current === 'categories',
        },
      ]}
    />
  )
}
