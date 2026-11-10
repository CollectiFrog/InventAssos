import type { Handle } from 'remix/component'

import { routes } from '../../../routes.ts'
import { CsrfField, ErrorSummary, type FieldErrors, TextField } from '../../../ui/form.tsx'
import { Layout, SignOutButton, type Viewer } from '../../../ui/layout.tsx'

/** Props of the profile page. */
export interface ProfilePageProps {
  viewer: Viewer
  csrfToken: string
  email: string
  values: { name: string; phone: string }
  errors?: FieldErrors
  saved?: boolean
}

/** Name and optional phone of the signed-in person (US-0.2.6). */
export function ProfilePage(handle: Handle<ProfilePageProps>) {
  return () => {
    const { viewer, csrfToken, email, values, errors = {}, saved } = handle.props
    return (
      <Layout title="Mon profil" viewer={viewer} headerLink="account">
        <h1>Mon profil</h1>
        {saved ? (
          <p class="notice notice-success" role="status">
            Profil enregistré.
          </p>
        ) : null}
        <ErrorSummary errors={errors} />
        <form method="post" action={routes.account.profile.action.href()} class="stack">
          <CsrfField token={csrfToken} />
          <p>
            Adresse e-mail : <strong>{email}</strong>
          </p>
          <TextField
            name="name"
            label="Nom et prénom"
            value={values.name}
            error={errors.name}
            required
            autoComplete="name"
            maxLength={120}
          />
          <TextField
            name="phone"
            label="Téléphone"
            type="tel"
            value={values.phone}
            error={errors.phone}
            autoComplete="tel"
            maxLength={25}
            hint="Visible par tous les utilisateurs validés de la plateforme, pour qu’ils puissent vous joindre au sujet du matériel. Laissez vide pour ne pas le partager."
          />
          <button type="submit">Enregistrer</button>
        </form>
        <h2>Session</h2>
        <p>Sur un appareil partagé, déconnectez-vous en partant.</p>
        <SignOutButton csrfToken={csrfToken} />
      </Layout>
    )
  }
}
