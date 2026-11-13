import { redirect } from 'remix/response/redirect'
import { createController } from 'remix/router'

import { deleteImport } from '../../data/imports.ts'
import { routes } from '../../routes.ts'
import { landingHref, loadImport } from './shared.tsx'

/** Ending an import without importing anything (ADR 0026): nothing was written, nothing is logged. */
export default createController(routes.imports, {
  actions: {
    async cancel(context) {
      const loaded = await loadImport(context, context.params.importId)
      if (loaded instanceof Response) return loaded
      await deleteImport(context.db, loaded.pending.id)
      context.session.flash('notice', 'Import abandonné : rien n’a été ajouté.')
      return redirect(landingHref(loaded.location), 303)
    },
  },
})
