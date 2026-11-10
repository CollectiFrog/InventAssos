import type { Handle } from 'remix/component'

import { routes } from '../../routes.ts'
import { Layout, type Viewer } from '../../ui/layout.tsx'

/** Props of the status page. */
export interface StatusPageProps {
  viewer: Viewer
  status: 'pending' | 'rejected'
  rejectionReason: string | null
  csrfToken: string
}

/** Where a pending or rejected person stands (US-0.2.3). */
export function StatusPage(handle: Handle<StatusPageProps>) {
  return () => {
    const { viewer, status, rejectionReason, csrfToken } = handle.props
    return (
      <Layout title="Votre compte" viewer={viewer}>
        <h1>Votre compte</h1>
        {status === 'pending' ? (
          <div class="notice">
            <p>
              <strong>Votre demande est en cours d’examen.</strong>
            </p>
            <p>
              Un administrateur de la plateforme va la valider. Vous recevrez un e-mail dès que
              votre compte sera ouvert ; en attendant, l’inventaire n’est pas accessible.
            </p>
          </div>
        ) : (
          <>
            <div class="notice notice-error">
              <p>
                <strong>Votre demande a été refusée.</strong>
              </p>
              {rejectionReason ? <p>Motif : {rejectionReason}</p> : null}
            </div>
            <form method="post" action={routes.account.reapply.href()} class="stack">
              <input type="hidden" name="_csrf" value={csrfToken} />
              <p>Si la situation a changé, vous pouvez refaire une demande.</p>
              <button type="submit">Refaire une demande</button>
            </form>
          </>
        )}
      </Layout>
    )
  }
}
