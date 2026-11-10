import type { Handle } from 'remix/component'

import { routes } from '../../routes.ts'
import { CsrfField, ErrorSummary, type FieldErrors, TextField } from '../../ui/form.tsx'
import { Layout } from '../../ui/layout.tsx'

/** Values and errors re-displayed after a failed submission. */
export interface SignUpPageProps {
  csrfToken: string
  values?: { name: string; email: string }
  errors?: FieldErrors
}

/** Sign-up form (US-0.2.1). */
export function SignUpPage(handle: Handle<SignUpPageProps>) {
  return () => {
    const { csrfToken, values, errors = {} } = handle.props
    return (
      <Layout title="Créer un compte">
        <h1>Créer un compte</h1>
        <p>
          Votre demande sera examinée par un administrateur de la plateforme. Vous recevrez un
          e-mail quand votre compte sera validé.
        </p>
        <ErrorSummary errors={errors} />
        <form method="post" action={routes.signUp.form.action.href()} class="stack">
          <CsrfField token={csrfToken} />
          <TextField
            name="name"
            label="Nom et prénom"
            value={values?.name}
            error={errors.name}
            required
            autoComplete="name"
            maxLength={120}
          />
          <TextField
            name="email"
            label="Adresse e-mail"
            type="email"
            value={values?.email}
            error={errors.email}
            required
            autoComplete="email"
            maxLength={254}
          />
          <button type="submit">Demander un compte</button>
        </form>
      </Layout>
    )
  }
}

/** Confirmation shown after any sign-up, whether the e-mail was new or not. */
export function SignUpSentPage() {
  return () => (
    <Layout title="Demande envoyée">
      <h1>Demande envoyée</h1>
      <p>
        Merci ! Si l’adresse est valide, vous allez recevoir un e-mail de confirmation. Un
        administrateur va examiner votre demande.
      </p>
      <p>
        <a href={routes.home.href()}>Retour à l’accueil</a>
      </p>
    </Layout>
  )
}
