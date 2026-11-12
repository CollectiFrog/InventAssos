import type { Handle } from 'remix/component'
import { createController } from 'remix/router'

import { type ItemSummary, listItemsOwnedBy } from '../../data/items.ts'
import { listManagedCollectifs } from '../../data/members.ts'
import { findUserById } from '../../data/users.ts'
import { canSeePerson, isValidatedUser, itemScopeOf } from '../../permissions.ts'
import { routes } from '../../routes.ts'
import { Layout, type Viewer } from '../../ui/layout.tsx'
import { backHref } from '../back-link.ts'
import { forbidden, notFound, requireUser } from '../guards.tsx'
import { ItemList } from '../items/items-pages.tsx'
import { viewerOf } from '../viewer.ts'

/** A person and the equipment they own (US-0.6.4). Phone shown as stated at sign-up (ADR 0010). */
function PersonPage(
  handle: Handle<{
    viewer: Viewer
    name: string
    phone: string | null
    items: ItemSummary[]
    back: string
  }>,
) {
  return () => {
    const { viewer, name, phone, items, back } = handle.props
    return (
      <Layout
        title={name}
        viewer={viewer}
        back={back}
        trail={[{ label: 'Accueil', href: routes.home.href() }, { label: name }]}
      >
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

/** People pages: active accounts, for those who share a collectif with them (ADR 0021). */
export default createController(routes.people, {
  actions: {
    async show(context) {
      const actor = requireUser(context)
      if (actor instanceof Response) return actor
      if (!isValidatedUser(actor)) return forbidden(context)

      const person = await findUserById(context.db, context.params.userId)
      if (person === null || person.status !== 'active') return notFound(context)
      const collectifs = await listManagedCollectifs(context.db, person.id)
      // 404, not 403: whether this person has an account is not for strangers to know.
      if (!canSeePerson(actor, { id: person.id, collectifIds: collectifs.map((c) => c.id) })) {
        return notFound(context)
      }
      return context.render(
        <PersonPage
          viewer={viewerOf(context)}
          name={person.name}
          phone={person.phone}
          back={backHref(context, routes.home.href())}
          items={await listItemsOwnedBy(context.db, { userId: person.id }, itemScopeOf(actor))}
        />,
      )
    },
  },
})
