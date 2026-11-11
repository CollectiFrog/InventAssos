import type { Handle } from 'remix/component'

/** One tab: a link to its own URL, so tabs work without JavaScript and can be shared. */
export interface Tab {
  label: string
  href: string
  current: boolean
}

/** Tabs inside a page (ui.md, "Tabs"): a <nav> of links, the current one marked. */
export function Tabs(handle: Handle<{ label: string; tabs: Tab[] }>) {
  return () => (
    <nav aria-label={handle.props.label} class="tabs">
      {handle.props.tabs.map((tab) => (
        <a href={tab.href} aria-current={tab.current ? 'page' : undefined}>
          {tab.label}
        </a>
      ))}
    </nav>
  )
}
