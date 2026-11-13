import type { Handle } from 'remix/component'

import { routes } from '../../../routes.ts'
import { Layout, type Viewer } from '../../../ui/layout.tsx'
import { AdminTabs, adminBack, adminTrail } from '../admin-tabs.tsx'

/** One active collectif as the admins oversee it. */
export interface AdminCollectifRow {
  name: string
  slug: string
  city: string
  responsibles: number
  items: number
}

/** Administration › Collectifs: every active collectif, to reach its responsibles (US-0.3.6). */
export function AdminCollectifsPage(
  handle: Handle<{ viewer: Viewer; collectifs: AdminCollectifRow[] }>,
) {
  return () => {
    const { viewer, collectifs } = handle.props
    return (
      <Layout
        title="Collectifs"
        viewer={viewer}
        headerLink="account"
        trail={adminTrail}
        back={adminBack}
      >
        <h1>Administration</h1>
        <AdminTabs current="collectifs" viewer={viewer} />
        <p class="status">
          Les collectifs validés. Un collectif sans responsable n’est plus géré : nommez-en un
          depuis son onglet Responsables.
        </p>
        {collectifs.length === 0 ? (
          <p>Aucun collectif validé pour l’instant.</p>
        ) : (
          <table class="data-table">
            <caption class="visually-hidden">Collectifs validés</caption>
            <thead>
              <tr>
                <th scope="col">Collectif</th>
                <th scope="col">Ville</th>
                <th scope="col" class="num">
                  Responsables
                </th>
                <th scope="col" class="num">
                  Objets
                </th>
              </tr>
            </thead>
            <tbody>
              {collectifs.map((c) => (
                <tr key={c.slug}>
                  <td data-label="Collectif" class="cell-name">
                    <a href={routes.collectifs.people.href({ slug: c.slug })}>
                      <strong>{c.name}</strong>
                    </a>
                  </td>
                  <td data-label="Ville">{c.city || '—'}</td>
                  <td data-label="Responsables" class={c.responsibles === 0 ? 'num error' : 'num'}>
                    {c.responsibles}
                  </td>
                  <td data-label="Objets" class="num">
                    {c.items}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Layout>
    )
  }
}
