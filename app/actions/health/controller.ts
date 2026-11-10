import { createController } from 'remix/router'

import { pingDatabase } from '../../data/health.ts'
import { routes } from '../../routes.ts'

// Probes must never be cached by a proxy: a stale "ok" would hide an outage.
const headers = { 'Cache-Control': 'no-store' }

export default createController(routes.health, {
  actions: {
    // Liveness: the process answers. Does not touch the database, so a DB outage never restarts pods.
    live() {
      return Response.json({ status: 'ok' }, { headers })
    },
    // Readiness: the database answers, so the pod may receive traffic.
    async ready(context) {
      const databaseOk = await pingDatabase(context.db)
      return Response.json(
        { status: databaseOk ? 'ok' : 'unavailable', database: databaseOk ? 'ok' : 'unavailable' },
        { status: databaseOk ? 200 : 503, headers },
      )
    },
  },
})
