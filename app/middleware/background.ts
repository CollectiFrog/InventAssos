import { createContextKey, type Middleware } from 'remix/router'

import type { BackgroundTasks } from '../background.ts'

/** Context key for background work; actions read it as `context.background`. */
export const BackgroundKey = createContextKey<BackgroundTasks>()

/** Puts the background task runner on every request context. */
export function provideBackground(background: BackgroundTasks): Middleware<{
  key: typeof BackgroundKey
  value: BackgroundTasks
  property: 'background'
}> {
  return (context, next) => {
    context.set(BackgroundKey, background, { property: 'background' })
    return next()
  }
}
