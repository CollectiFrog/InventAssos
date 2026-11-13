import type { Handle } from 'remix/component'

/** One step of a wizard: done steps link back, the current one is marked, later ones are text. */
export interface Step {
  label: string
  href?: string
  state: 'done' | 'current' | 'todo'
}

/** The steps of a wizard (ADR 0022), as an ordered list read by screen readers in order. */
export function Steps(handle: Handle<{ label: string; steps: Step[] }>) {
  return () => (
    <nav aria-label={handle.props.label}>
      <ol class="steps">
        {handle.props.steps.map((step, index) => (
          <li key={step.label} class={`step step-${step.state}`}>
            {step.state === 'done' && step.href ? (
              <a href={step.href} class="step-link">
                {index + 1}. {step.label}
              </a>
            ) : (
              <span aria-current={step.state === 'current' ? 'step' : undefined}>
                {index + 1}. {step.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}
