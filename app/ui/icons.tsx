// Icons and icon buttons (ADR 0031): one shape per kind of action, everywhere. The visible part is
// the icon; the name stays in a visually hidden span (screen readers, voice control) and in `title`.
import type { Handle, RemixNode } from 'remix/component'

/** Strokes of each icon, on a 24 px grid. */
export const icons = {
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </>
  ),
  add: <path d="M12 5v14M5 12h14" />,
  edit: (
    <>
      <path d="M4 20h4L19 9l-4-4L4 16z" />
      <path d="M13.5 6.5l4 4" />
    </>
  ),
  move: (
    <>
      <path d="M5 12h14M15 8l4 4-4 4" />
      <path d="M9 4H5v16h4" />
    </>
  ),
  archive: (
    <>
      <path d="M3 4h18v4H3z" />
      <path d="M5 8v12h14V8M10 12h4" />
    </>
  ),
  remove: (
    <>
      <path d="M4 7h16M10 11v6M14 11v6" />
      <path d="M6 7l1 13h10l1-13M9 7V4h6v3" />
    </>
  ),
  askRemoval: (
    <>
      <path d="M4 7h16M6 7l1 13h10l1-13M9 7V4h6v3" />
      <path d="M10.5 12a1.5 1.5 0 1 1 2 1.4c-.4.2-.5.5-.5.9M12 17h.01" />
    </>
  ),
  moderate: (
    <>
      <path d="M5 21V4" />
      <path d="M5 4h12l-2 4 2 4H5" />
    </>
  ),
  upload: (
    <>
      <path d="M12 16V4M7 9l5-5 5 5" />
      <path d="M4 16v4h16v-4" />
    </>
  ),
  download: (
    <>
      <path d="M12 4v12M7 11l5 5 5-5" />
      <path d="M4 16v4h16v-4" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 8h.01" />
    </>
  ),
} satisfies Record<string, RemixNode>

/** A kind of icon from `icons`. */
export type IconName = keyof typeof icons

/** An inline icon, hidden from assistive technology: its name is said by the control around it. */
export function Icon(handle: Handle<{ name?: IconName; size?: number; children?: RemixNode }>) {
  return () => {
    const { name, size = 22, children } = handle.props
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        {name ? icons[name] : children}
      </svg>
    )
  }
}

/** Shared props of a square icon action. */
interface IconActionProps {
  icon: IconName
  /** The action's name: read aloud, matched by voice control, shown on hover. */
  label: string
  /** A destructive action keeps the same shape, in the danger colour. */
  danger?: boolean
  /** The main action of its group: filled instead of outlined. */
  primary?: boolean
}

function classOf(props: IconActionProps): string {
  const tone = props.danger ? 'danger-icon' : props.primary ? '' : 'secondary'
  return ['button', tone, 'icon-button'].filter(Boolean).join(' ')
}

/** A square link showing an icon (ADR 0031). */
export function IconLink(handle: Handle<IconActionProps & { href: string }>) {
  return () => {
    const { href, icon, label } = handle.props
    return (
      <a class={classOf(handle.props)} href={href} title={label}>
        <Icon name={icon} />
        <span class="visually-hidden">{label}</span>
      </a>
    )
  }
}

/** A square submit button showing an icon, for a form that does one thing (ADR 0031). */
export function IconButton(handle: Handle<IconActionProps & { formAction?: string }>) {
  return () => {
    const { icon, label, formAction } = handle.props
    return (
      <button
        type="submit"
        class={classOf(handle.props).replace('button ', '')}
        title={label}
        formAction={formAction}
      >
        <Icon name={icon} />
        <span class="visually-hidden">{label}</span>
      </button>
    )
  }
}
