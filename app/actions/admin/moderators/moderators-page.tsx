import type { Handle } from 'remix/component'

import type { User } from '../../../data/tables.ts'
import { routes } from '../../../routes.ts'
import { CsrfField, ErrorSummary, type FieldErrors, TextField } from '../../../ui/form.tsx'
import { Layout, type Viewer } from '../../../ui/layout.tsx'
import { AdminTabs } from '../admin-tabs.tsx'

/** Props of Administration › Modérateurs. */
export interface ModeratorsPageProps {
  viewer: Viewer
  csrfToken: string
  moderators: User[]
  values: Record<string, string>
  errors: FieldErrors
  notice?: string
}

/** Administration › Modérateurs (US-0.8.1): the moderators, each removable, and a form to name one. */
export function ModeratorsPage(handle: Handle<ModeratorsPageProps>) {
  return () => {
    const { viewer, csrfToken, moderators, values, errors, notice } = handle.props
    return (
      <Layout title="Modérateurs" viewer={viewer} headerLink="admin">
        <h1>Administration</h1>
        <AdminTabs current="moderators" viewer={viewer} />
        {notice ? (
          <p class="notice notice-success" role="status">
            {notice}
          </p>
        ) : null}
        <ErrorSummary errors={errors} />
        <p>
          Les modérateurs traitent les demandes, désactivent ou réactivent des comptes, gèrent les
          catégories et retirent du matériel abusif. Ils ne peuvent agir ni sur un administrateur ni
          sur un autre modérateur.
        </p>
        <h2 id="moderateurs">Modérateurs</h2>
        {moderators.length === 0 ? (
          <p>Aucun modérateur pour l’instant.</p>
        ) : (
          <ul class="cards">
            {moderators.map((user) => (
              <li key={user.id} class="card row">
                <span>
                  <strong>{user.name}</strong> · {user.email}
                  {user.status === 'active' ? null : <span class="status"> · désactivé</span>}
                </span>
                <form
                  method="post"
                  action={routes.admin.moderators.remove.href({ userId: user.id })}
                >
                  <CsrfField token={csrfToken} />
                  <button type="submit" class="danger">
                    Retirer
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
        <h2 id="nommer">Nommer un modérateur</h2>
        <form method="post" action={routes.admin.moderators.name.href()} class="stack">
          <CsrfField token={csrfToken} />
          <TextField
            name="email"
            label="Adresse e-mail"
            type="email"
            value={values.email}
            error={errors.email}
            required
            autoComplete="off"
            maxLength={254}
            hint="Celle d’un compte validé. La personne garde son matériel et ses collectifs."
          />
          <button type="submit">Nommer modérateur</button>
        </form>
      </Layout>
    )
  }
}
