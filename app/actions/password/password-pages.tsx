import type { Handle } from 'remix/component'

import { passwordMaxLength, passwordMinLength } from '../../passwords.ts'
import { routes } from '../../routes.ts'
import { CsrfField, ErrorSummary, type FieldErrors, TextField } from '../../ui/form.tsx'
import { Layout, type Viewer } from '../../ui/layout.tsx'

/** Asks for the e-mail that receives the link to choose a password (US-0.10.8). */
export function PasswordRequestPage(
  handle: Handle<{ viewer?: Viewer; csrfToken: string; email?: string; errors?: FieldErrors }>,
) {
  return () => {
    const { viewer, csrfToken, email, errors = {} } = handle.props
    return (
      <Layout title="Choisir un mot de passe" viewer={viewer}>
        <h1>Choisir un mot de passe</h1>
        <p>
          Pour créer votre mot de passe ou en changer, nous vous envoyons un lien par e-mail. Vous
          pourrez toujours vous connecter aussi avec un lien.
        </p>
        <ErrorSummary errors={errors} />
        <form method="post" action={routes.password.request.action.href()} class="stack">
          <CsrfField token={csrfToken} />
          <TextField
            name="email"
            label="Adresse e-mail"
            type="email"
            value={email}
            error={errors.email}
            required
            autoComplete="email"
            maxLength={254}
          />
          <button type="submit">Recevoir le lien</button>
        </form>
        <p>
          <a href={routes.signIn.form.index.href()}>Retour à la connexion</a>
        </p>
      </Layout>
    )
  }
}

/** Shown after every request, whether the e-mail has an account or not. */
export function PasswordSentPage(handle: Handle<{ viewer?: Viewer }>) {
  return () => (
    <Layout title="Lien envoyé" viewer={handle.props.viewer}>
      <h1>Vérifiez vos e-mails</h1>
      <p>
        Si un compte existe pour cette adresse, un lien pour choisir votre mot de passe vient de lui
        être envoyé. Il est valable 30 minutes et ne fonctionne qu’une fois.
      </p>
      <p>
        Rien reçu ? Regardez dans les indésirables, ou{' '}
        <a href={routes.password.request.index.href()}>demandez un nouveau lien</a>.
      </p>
    </Layout>
  )
}

/** The new password, twice; sent from the e-mailed link (US-0.10.8). */
export function PasswordChoosePage(
  handle: Handle<{ csrfToken: string; token: string; errors?: FieldErrors }>,
) {
  return () => {
    const { csrfToken, token, errors = {} } = handle.props
    return (
      <Layout title="Nouveau mot de passe">
        <h1>Nouveau mot de passe</h1>
        <ErrorSummary errors={errors} />
        <form method="post" action={routes.password.choose.action.href({ token })} class="stack">
          <CsrfField token={csrfToken} />
          <TextField
            name="password"
            label="Mot de passe"
            type="password"
            error={errors.password}
            required
            autoComplete="new-password"
            maxLength={passwordMaxLength}
            hint={`Au moins ${passwordMinLength} caractères. Une phrase facile à retenir convient très bien.`}
          />
          <TextField
            name="confirmation"
            label="Confirmer le mot de passe"
            type="password"
            error={errors.confirmation}
            required
            autoComplete="new-password"
            maxLength={passwordMaxLength}
          />
          <button type="submit">Enregistrer et me connecter</button>
        </form>
      </Layout>
    )
  }
}

/** The password link is unknown, expired, already used, or its account cannot sign in. */
export function PasswordLinkInvalidPage() {
  return () => (
    <Layout title="Lien invalide">
      <h1>Ce lien ne fonctionne plus</h1>
      <p>Il a expiré, a déjà servi, ou le compte n’est plus actif.</p>
      <p>
        <a class="button" href={routes.password.request.index.href()}>
          Demander un nouveau lien
        </a>
      </p>
    </Layout>
  )
}
