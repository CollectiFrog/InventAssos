import type { Handle } from 'remix/component'

import type { User } from '../../data/tables.ts'
import { routes } from '../../routes.ts'
import { CsrfField } from '../../ui/form.tsx'
import { Layout, type Viewer } from '../../ui/layout.tsx'

const dateFormat = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeZone: 'Europe/Paris' })

/** Props of the account review page. */
export interface AccountsPageProps {
  viewer: Viewer
  csrfToken: string
  pending: User[]
  active: User[]
  /** The admin viewing the page: they cannot disable themselves. */
  selfId: string
  notice?: string
}

/** Pending accounts with accept and reject buttons (US-0.2.4). */
export function AccountsPage(handle: Handle<AccountsPageProps>) {
  return () => {
    const { viewer, csrfToken, pending, active, selfId, notice } = handle.props
    return (
      <Layout title="Comptes à valider" viewer={viewer}>
        <h1>Comptes à valider</h1>
        {notice ? (
          <p class="notice notice-success" role="status">
            {notice}
          </p>
        ) : null}
        {pending.length === 0 ? (
          <p>Aucune demande en attente.</p>
        ) : (
          <ul class="cards">
            {pending.map((user) => (
              <li key={user.id} class="card">
                <p>
                  <strong>{user.name}</strong> · {user.email}
                  <br />
                  <span class="status">
                    Demande du {dateFormat.format(new Date(String(user.created_at)))}
                  </span>
                </p>
                <div class="actions">
                  <form
                    method="post"
                    action={routes.admin.approveAccount.href({ userId: user.id })}
                  >
                    <CsrfField token={csrfToken} />
                    <button type="submit">Accepter</button>
                  </form>
                  <form
                    method="post"
                    action={routes.admin.rejectAccount.href({ userId: user.id })}
                    class="inline-form"
                  >
                    <CsrfField token={csrfToken} />
                    <label for={`reason-${user.id}`}>Motif (facultatif)</label>
                    <input id={`reason-${user.id}`} name="reason" maxLength={500} />
                    <button type="submit" class="danger">
                      Refuser
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
        <h2>Comptes actifs</h2>
        <p>
          Désactiver un compte coupe immédiatement ses accès (ses sessions sont fermées) sans rien
          supprimer : son matériel reste visible.
        </p>
        <ul class="cards">
          {active.map((user) => (
            <li key={user.id} class="card row">
              <span>
                <strong>{user.name}</strong> · {user.email}
              </span>
              {user.id === selfId ? (
                <span class="status">vous</span>
              ) : (
                <form method="post" action={routes.admin.disableAccount.href({ userId: user.id })}>
                  <CsrfField token={csrfToken} />
                  <button type="submit" class="danger">
                    Désactiver
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>
      </Layout>
    )
  }
}
