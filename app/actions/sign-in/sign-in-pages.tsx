import type { Handle } from 'remix/component'

import { routes } from '../../routes.ts'
import { CsrfField, ErrorSummary, type FieldErrors, TextField } from '../../ui/form.tsx'
import { Layout } from '../../ui/layout.tsx'
import { returnParam } from '../return-path.ts'

/** E-mail form asking for a sign-in link (US-0.2.2). */
export function SignInPage(
  handle: Handle<{
    csrfToken: string
    email?: string
    errors?: FieldErrors
    /** The page to land on after signing in (US-0.7.8). */
    returnPath?: string | null
  }>,
) {
  return () => {
    const { csrfToken, email, errors = {}, returnPath } = handle.props
    return (
      <Layout title="Se connecter">
        <h1>Se connecter</h1>
        <p>Pas de mot de passe : nous vous envoyons un lien de connexion par e-mail.</p>
        <ErrorSummary errors={errors} />
        {returnPath ? <p class="status">Connectez-vous pour ouvrir la page demandée.</p> : null}
        <form method="post" action={routes.signIn.form.action.href()} class="stack">
          <CsrfField token={csrfToken} />
          {returnPath ? <input type="hidden" name={returnParam} value={returnPath} /> : null}
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
          Pas encore de compte ? <a href={routes.signUp.form.index.href()}>Créer un compte</a>
        </p>
      </Layout>
    )
  }
}

/** Shown after every request, whether the e-mail has an account or not. */
export function SignInSentPage() {
  return () => (
    <Layout title="Lien envoyé">
      <h1>Vérifiez vos e-mails</h1>
      <p>
        Si un compte existe pour cette adresse, un lien de connexion vient de lui être envoyé. Il
        est valable 15 minutes et ne fonctionne qu’une fois.
      </p>
      <p>
        Rien reçu ? Regardez dans les indésirables, ou{' '}
        <a href={routes.signIn.form.index.href()}>demandez un nouveau lien</a>.
      </p>
    </Layout>
  )
}

/** The link is unknown, expired, already used, or its account cannot sign in. */
export function SignInLinkInvalidPage() {
  return () => (
    <Layout title="Lien invalide">
      <h1>Ce lien ne fonctionne plus</h1>
      <p>Il a expiré, a déjà servi, ou le compte n’est plus actif.</p>
      <p>
        <a class="button" href={routes.signIn.form.index.href()}>
          Demander un nouveau lien
        </a>
      </p>
    </Layout>
  )
}
