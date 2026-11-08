import type { Handle } from 'remix/component'

import { routes } from '../../routes.ts'
import { CsrfField, ErrorSummary, type FieldErrors, TextField } from '../../ui/form.tsx'
import { Layout } from '../../ui/layout.tsx'

/** E-mail form asking for a sign-in link (US-0.2.2). */
export function SignInPage(
  handle: Handle<{ csrfToken: string; email?: string; errors?: FieldErrors }>,
) {
  return () => {
    const { csrfToken, email, errors = {} } = handle.props
    return (
      <Layout title="Se connecter">
        <h1>Se connecter</h1>
        <p>Pas de mot de passe : nous vous envoyons un lien de connexion par e-mail.</p>
        <ErrorSummary errors={errors} />
        <form method="post" action={routes.signIn.form.action.href()} class="stack">
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

/** Opened from the e-mail: a button confirms, so link scanners cannot use the token. */
export function SignInLinkPage(handle: Handle<{ csrfToken: string; token: string }>) {
  return () => (
    <Layout title="Connexion">
      <h1>Connexion</h1>
      <form
        method="post"
        action={routes.signIn.link.action.href({ token: handle.props.token })}
        class="stack"
      >
        <CsrfField token={handle.props.csrfToken} />
        <button type="submit">Me connecter</button>
      </form>
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
