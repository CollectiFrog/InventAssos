import type { Handle, RemixNode } from 'remix/component'

import { CsrfField, FieldHint, HintMark, hoverText } from './form.tsx'
import { IconButton, IconLink } from './icons.tsx'

/** One row of a settings page: the setting, its state, and its action (ADR 0034). */
export function SettingRow(
  handle: Handle<{ id: string; label: string; value?: RemixNode; children?: RemixNode }>,
) {
  return () => {
    const { id, label, value, children } = handle.props
    return (
      <div id={id} class="setting-row">
        <span class="setting-label">{label}</span>
        <span class="setting-value">{value}</span>
        {children ? <div class="setting-action">{children}</div> : null}
      </div>
    )
  }
}

/** Props of a setting edited in place. */
export interface EditableSettingProps {
  /** The row's anchor, also the value of `?modifier=` that opens it. */
  id: string
  label: string
  /** The stored value, or the value typed when the server sends the row back with an error. */
  value: string
  /** Shown instead of an empty value. */
  empty: string
  /** The row shows its field instead of its value. */
  editing: boolean
  /** Where the pencil leads: the same page with this row editing. */
  editHref: string
  /** Where « Annuler » leads: the same page, unchanged. */
  cancelHref: string
  action: string
  csrfToken: string
  name: string
  type?: 'text' | 'tel'
  required?: boolean
  autoComplete?: string
  maxLength?: number
  hint?: string
  error?: string
}

/**
 * A setting edited in its own row, without JavaScript (ADR 0034): the pencil reloads the page with
 * the row editing; the value becomes a focused field, the pencil « Enregistrer » and « Annuler ».
 * The row keeps its place and its shape.
 */
export function EditableSettingRow(handle: Handle<EditableSettingProps>) {
  return () => {
    const p = handle.props
    const fieldId = `field-${p.name}`
    const editLabel = `Modifier : ${p.label.toLowerCase()}`
    if (!p.editing) {
      return (
        <div id={p.id} class="setting-row">
          <span class="setting-label">
            {p.label}
            <HintMark hint={p.hint} />
          </span>
          <span class="setting-value">{p.value === '' ? p.empty : p.value}</span>
          <div class="setting-action">
            <IconLink href={p.editHref} icon="edit" label={editLabel} />
          </div>
        </div>
      )
    }
    const describedBy = [p.hint ? `${fieldId}-hint` : null, p.error ? `${fieldId}-error` : null]
      .filter(Boolean)
      .join(' ')
    return (
      <form
        id={p.id}
        method="post"
        action={p.action}
        class={p.error ? 'setting-row setting-invalid' : 'setting-row'}
      >
        <CsrfField token={p.csrfToken} />
        <label for={fieldId} class="setting-label">
          {p.label}
          <HintMark hint={p.hint} />
        </label>
        <FieldHint id={`${fieldId}-hint`} hint={p.hint} />
        <span class="setting-value">
          <input
            id={fieldId}
            name={p.name}
            // The JSX types narrow attributes per input type; both accepted ones are text-like.
            type={(p.type ?? 'text') as 'text'}
            value={p.value}
            required={p.required}
            autoComplete={p.autoComplete}
            maxLength={p.maxLength}
            // biome-ignore lint/a11y/noAutofocus: the person just asked to edit this field.
            autoFocus
            title={hoverText(p.hint)}
            aria-invalid={p.error ? 'true' : undefined}
            aria-describedby={describedBy || undefined}
          />
        </span>
        <div class="setting-action icon-toolbar">
          <IconButton icon="check" label="Enregistrer" primary />
          <IconLink href={p.cancelHref} icon="close" label="Annuler" />
        </div>
        {p.error ? (
          <p class="error setting-error" id={`${fieldId}-error`}>
            {p.error}
          </p>
        ) : null}
      </form>
    )
  }
}
