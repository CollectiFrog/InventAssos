import type { Handle, RemixNode } from 'remix/component'

/** Field errors keyed by field name, as returned by `parseForm`. */
export type FieldErrors = Partial<Record<string, string>>

/** Hidden CSRF token; every POST form must include it (csrf middleware). */
export function CsrfField(handle: Handle<{ token: string }>) {
  return () => <input type="hidden" name="_csrf" value={handle.props.token} />
}

/** Props of a labelled text input. */
export interface TextFieldProps {
  name: string
  label: string
  value?: string | null
  error?: string
  hint?: RemixNode
  type?: 'text' | 'email' | 'tel' | 'number' | 'search'
  required?: boolean
  /** Required only when its section is used: no "(facultatif)", and the server checks it. */
  requiredIfUsed?: boolean
  autoComplete?: string
  maxLength?: number
}

/** A labelled input with its hint and error message, linked for screen readers. */
export function TextField(handle: Handle<TextFieldProps>) {
  return () => {
    const p = handle.props
    const id = `field-${p.name}`
    const describedBy = [p.hint ? `${id}-hint` : null, p.error ? `${id}-error` : null]
      .filter(Boolean)
      .join(' ')

    return (
      <div class={p.error ? 'field field-invalid' : 'field'}>
        <label for={id}>
          {p.label}
          {p.required || p.requiredIfUsed ? null : <span class="optional"> (facultatif)</span>}
        </label>
        {p.hint ? (
          <p class="hint" id={`${id}-hint`}>
            {p.hint}
          </p>
        ) : null}
        <input
          id={id}
          name={p.name}
          // The JSX types narrow attributes per input type; this component accepts the text-like ones.
          type={(p.type ?? 'text') as 'text'}
          value={p.value ?? ''}
          required={p.required}
          autoComplete={p.autoComplete}
          maxLength={p.maxLength}
          aria-invalid={p.error ? 'true' : undefined}
          aria-describedby={describedBy || undefined}
        />
        {p.error ? (
          <p class="error" id={`${id}-error`}>
            {p.error}
          </p>
        ) : null}
      </div>
    )
  }
}

/** Props of a labelled multi-line text input. */
export interface TextAreaProps {
  name: string
  label: string
  value?: string | null
  error?: string
  hint?: RemixNode
  required?: boolean
  maxLength?: number
}

/** A labelled textarea with its hint and error message. */
export function TextArea(handle: Handle<TextAreaProps>) {
  return () => {
    const p = handle.props
    const id = `field-${p.name}`
    const describedBy = [p.hint ? `${id}-hint` : null, p.error ? `${id}-error` : null]
      .filter(Boolean)
      .join(' ')

    return (
      <div class={p.error ? 'field field-invalid' : 'field'}>
        <label for={id}>
          {p.label}
          {p.required ? null : <span class="optional"> (facultatif)</span>}
        </label>
        {p.hint ? (
          <p class="hint" id={`${id}-hint`}>
            {p.hint}
          </p>
        ) : null}
        <textarea
          id={id}
          name={p.name}
          rows={4}
          required={p.required}
          maxLength={p.maxLength}
          aria-invalid={p.error ? 'true' : undefined}
          aria-describedby={describedBy || undefined}
          value={p.value ?? ''}
        />
        {p.error ? (
          <p class="error" id={`${id}-error`}>
            {p.error}
          </p>
        ) : null}
      </div>
    )
  }
}

/** Banner shown above a form that failed validation. */
export function ErrorSummary(handle: Handle<{ errors: FieldErrors }>) {
  return () =>
    Object.keys(handle.props.errors).length === 0 ? null : (
      <div class="notice notice-error" role="alert">
        Le formulaire contient des erreurs : corrigez les champs signalés.
      </div>
    )
}

/** One choice of a select. */
export interface SelectOption {
  value: string
  label: string
}

/** Props of a labelled select. */
export interface SelectFieldProps {
  name: string
  label: string
  options: SelectOption[]
  value?: string | null
  error?: string
  hint?: RemixNode
  required?: boolean
  /** Label of an empty first option, for optional selects. */
  emptyLabel?: string
}

/** A labelled select with its hint and error message. */
export function SelectField(handle: Handle<SelectFieldProps>) {
  return () => {
    const p = handle.props
    const id = `field-${p.name}`
    return (
      <div class={p.error ? 'field field-invalid' : 'field'}>
        <label for={id}>
          {p.label}
          {p.required ? null : <span class="optional"> (facultatif)</span>}
        </label>
        {p.hint ? (
          <p class="hint" id={`${id}-hint`}>
            {p.hint}
          </p>
        ) : null}
        <select
          id={id}
          name={p.name}
          required={p.required}
          aria-invalid={p.error ? 'true' : undefined}
          aria-describedby={p.error ? `${id}-error` : undefined}
        >
          {p.emptyLabel !== undefined ? <option value="">{p.emptyLabel}</option> : null}
          {p.options.map((option) => (
            <option key={option.value} value={option.value} selected={option.value === p.value}>
              {option.label}
            </option>
          ))}
        </select>
        {p.error ? (
          <p class="error" id={`${id}-error`}>
            {p.error}
          </p>
        ) : null}
      </div>
    )
  }
}
