import type { Handle } from 'remix/component'
import { createController } from 'remix/router'

import { type ItemSummary, listItemsOwnedBy } from '../../data/items.ts'
import { findUserById } from '../../data/users.ts'
import { isValidatedUser } from '../../permissions.ts'
import { routes } from '../../routes.ts'
import { Layout, type Viewer } from '../../ui/layout.tsx'
import { forbidden, notFound, requireUser } from '../guards.tsx'
import { ItemList } from '../items/items-pages.tsx'
import { viewerOf } from '../viewer.ts'

/** A person and the equipment they own (US-0.6.4). Phone shown as stated at sign-up (ADR 0010). */
function PersonPage(
  handle: Handle<{ viewer: Viewer; name: string; phone: string | null; items: ItemSummary[] }>,
) {
  return () => {
    const { viewer, name, phone, items } = handle.props
    return (
      <Layout title={name} viewer={viewer}>
        <h1>{name}</h1>
        <dl class="facts">
          <dt>Téléphone</dt>
          <dd>{phone ?? 'non renseigné'}</dd>
        </dl>
        <h2>Matériel</h2>
        {items.length === 0 ? <p>Aucun matériel déclaré.</p> : <ItemList items={items} />}
      </Layout>
    )
  }
}

/** People pages; only active accounts are shown. */
export default createController(routes.people, {
  actions: {
    async show(context) {
      const actor = requireUser(context)
      if (actor instanceof Response) return actor
      if (!isValidatedUser(actor)) return forbidden(context)

      const person = await findUserById(context.db, context.params.userId)
      if (person === null || person.status !== 'active') return notFound(context)
      return context.render(
        <PersonPage
          viewer={viewerOf(context)}
          name={person.name}
          phone={person.phone}
          items={await listItemsOwnedBy(context.db, { userId: person.id })}
        />,
      )
    },
  },
})
