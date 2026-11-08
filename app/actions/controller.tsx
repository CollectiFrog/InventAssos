import { createController } from 'remix/router'

import { pingDatabase } from '../data/health.ts'
import { routes } from '../routes.ts'
import { HomePage } from './home-page.tsx'

export default createController(routes, {
  actions: {
    async home(context) {
      const databaseOk = await pingDatabase(context.db)
      return context.render(<HomePage databaseOk={databaseOk} />)
    },
  },
})
