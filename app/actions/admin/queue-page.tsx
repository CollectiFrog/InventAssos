import type { Handle } from 'remix/component'

import type { PendingCollectif } from '../../data/collectifs.ts'
import type { PendingResponsible } from '../../data/responsibles.ts'
import type { User } from '../../data/tables.ts'
import { routes } from '../../routes.ts'
import { CsrfField } from '../../ui/form.tsx'
import { Layout, type Viewer } from '../../ui/layout.tsx'

const dateFormat = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeZone: 'Europe/Paris' })

/** Props of the admin queue. */
export interface QueuePageProps {
  viewer: Viewer
  csrfToken: string
  pending: User[]
  pendingCollectifs: PendingCollectif[]
  pendingResponsibles: PendingResponsible[]
  active: User[]
  disabled: User[]
  /** The admin viewing the page: they cannot disable themselves. */
  selfId: string
  /** Listed platform admins cannot be disabled from here (permissions.md). */
  adminEmails: ReadonlySet<string>
  notice?: string
}

/** Every pending request in one place (US-0.3.7), then the active accounts. */
export function QueuePage(handle: Handle<QueuePageProps>) {
  return () => {
    const {
      viewer,
      csrfToken,
      pending,
      pendingCollectifs,
      pendingResponsibles,
      active,
      disabled,
      selfId,
      adminEmails,
      notice,
    } = handle.props
    return (
      <Layout title="Administration" viewer={viewer} headerLink="admin">
        <h1>Administration</h1>
        {notice ? (
          <p class="notice notice-success" role="status">
            {notice}
          </p>
        ) : null}
        <ul class="summary" aria-label="Demandes en attente">
          <li>
            <a href="#comptes">{plural(pending.length, 'compte', 'comptes')}</a>
          </li>
          <li>
            <a href="#collectifs">{plural(pendingCollectifs.length, 'collectif', 'collectifs')}</a>
          </li>
          <li>
            <a href="#responsables">
              {plural(pendingResponsibles.length, 'responsable', 'responsables')}
            </a>
          </li>
        </ul>
        <h2 id="comptes">Comptes à valider</h2>
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
        <h2 id="collectifs">Collectifs à valider</h2>
        {pendingCollectifs.length === 0 ? (
          <p>Aucune demande de collectif.</p>
        ) : (
          <ul class="cards">
            {pendingCollectifs.map((c) => (
              <li key={c.id} class="card">
                <p>
                  <strong>{c.name}</strong>
                  <br />
                  <span class="status">
                    Demandé par {c.requesterName ?? 'compte supprimé'}
                    {c.requesterEmail ? ` (${c.requesterEmail})` : ''} le{' '}
                    {dateFormat.format(c.createdAt)}
                  </span>
                </p>
                {c.description ? <p>{c.description}</p> : null}
                {c.contactPhone ? <p>Téléphone : {c.contactPhone}</p> : null}
                <div class="actions">
                  <form
                    method="post"
                    action={routes.admin.collectifs.approve.href({ collectifId: c.id })}
                  >
                    <CsrfField token={csrfToken} />
                    <button type="submit">Accepter</button>
                  </form>
                  <form
                    method="post"
                    action={routes.admin.collectifs.reject.href({ collectifId: c.id })}
                    class="inline-form"
                  >
                    <CsrfField token={csrfToken} />
                    <label for={`collectif-reason-${c.id}`}>Motif (facultatif)</label>
                    <input id={`collectif-reason-${c.id}`} name="reason" maxLength={500} />
                    <button type="submit" class="danger">
                      Refuser
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
        <h2 id="responsables">Responsables à valider</h2>
        {pendingResponsibles.length === 0 ? (
          <p>Aucune demande de responsable.</p>
        ) : (
          <ul class="cards">
            {pendingResponsibles.map((r) => {
              const ids = { collectifId: r.collectifId, userId: r.userId }
              return (
                <li key={`${r.collectifId}-${r.userId}`} class="card row">
                  <span>
                    <strong>{r.userName}</strong> ({r.userEmail}) veut gérer{' '}
                    <strong>{r.collectifName}</strong>
                  </span>
                  <span class="actions">
                    <form method="post" action={routes.admin.responsibles.approve.href(ids)}>
                      <CsrfField token={csrfToken} />
                      <button type="submit">Accepter</button>
                    </form>
                    <form method="post" action={routes.admin.responsibles.reject.href(ids)}>
                      <CsrfField token={csrfToken} />
                      <button type="submit" class="danger">
                        Refuser
                      </button>
                    </form>
                  </span>
                </li>
              )
            })}
          </ul>
        )}
        <h2 id="comptes-actifs">Comptes actifs</h2>
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
              ) : adminEmails.has(user.email) ? (
                <span class="status">administrateur</span>
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
        <h2 id="comptes-desactives">Comptes désactivés</h2>
        {disabled.length === 0 ? (
          <p>Aucun compte désactivé.</p>
        ) : (
          <>
            <p>
              Réactiver un compte rend à la personne ses accès : elle peut de nouveau demander un
              lien de connexion.
            </p>
            <ul class="cards">
              {disabled.map((user) => (
                <li key={user.id} class="card row">
                  <span>
                    <strong>{user.name}</strong> · {user.email}
                  </span>
                  <form method="post" action={routes.admin.enableAccount.href({ userId: user.id })}>
                    <CsrfField token={csrfToken} />
                    <button type="submit">Réactiver</button>
                  </form>
                </li>
              ))}
            </ul>
          </>
        )}
      </Layout>
    )
  }
}

/** "0 compte en attente", "2 comptes en attente". */
function plural(count: number, one: string, many: string): string {
  return `${count} ${count > 1 ? many : one} en attente`
}
