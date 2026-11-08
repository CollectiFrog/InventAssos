import { redirect } from 'remix/response/redirect'
import { createController } from 'remix/router'

import { pingDatabase } from '../data/health.ts'
import { routes } from '../routes.ts'
import { HomePage } from './home-page.tsx'
import { viewerOf } from './viewer.ts'

export default createController(routes, {
  actions: {
    async home(context) {
      const databaseOk = await pingDatabase(context.db)
      return context.render(<HomePage databaseOk={databaseOk} viewer={viewerOf(context)} />)
    },
    // US-0.2.8: deletes the session row, so the old cookie is worthless even if it was copied.
    signOut(context) {
      context.session.destroy()
      return redirect(routes.home.href(), 303)
    },
  },
})
