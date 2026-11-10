// Work that goes on after the response is sent, e.g. e-mails whose SMTP round-trip must not show in
// the response time (review F3). Tracked, so tests and a clean shutdown can wait for it.

/** Runs tasks after the response; `idle()` resolves once none is left. */
export interface BackgroundTasks {
  run(task: () => Promise<void>): void
  idle(): Promise<void>
}

/** Creates a task tracker; a failing task is logged, never thrown at the caller. */
export function createBackgroundTasks(): BackgroundTasks {
  const pending = new Set<Promise<void>>()
  return {
    run(task) {
      // setImmediate: start only once the current request has finished its own work.
      const promise: Promise<void> = new Promise<void>((resolve) => setImmediate(resolve))
        .then(task)
        .catch((error: unknown) => console.error('[background] task failed', error))
        .finally(() => pending.delete(promise))
      pending.add(promise)
    },
    async idle() {
      while (pending.size > 0) await Promise.all(pending)
    },
  }
}
