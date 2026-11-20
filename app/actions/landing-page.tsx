import type { Handle } from 'remix/component'
import { appName, sourceCodeUrl } from '../brand.ts'
import { routes } from '../routes.ts'
import { Icon } from '../ui/icons.tsx'
import { LandingScene } from '../ui/landing-scene/scene.tsx'
import { Layout, type Viewer } from '../ui/layout.tsx'

/** Stylesheets of the landing page: its layout, then the scene's generated timeline (ADR 0039). */
export const landingStylesheets = ['/landing.css', '/landing-scene.css'] as const

/**
 * The visitors' home page (US-0.10.24): one screen, the scene, the promise, join or sign in. The
 * scene tells the same as the text, so it stays hidden from assistive technology.
 */
export function LandingPage(handle: Handle<{ databaseOk: boolean; signedOut?: boolean }>) {
  return () => {
    const { databaseOk, signedOut } = handle.props
    return (
      <Layout title="Accueil" bare stylesheets={landingStylesheets}>
        <div class="landing">
          <div class="landing-scene">
            <LandingScene />
          </div>
          <div class="landing-text">
            <p class="landing-brand">
              <span class="logo" aria-hidden="true" />
              {appName}
            </p>
            <h1>À plusieurs, on a déjà tout le matériel.</h1>
            <p class="landing-lead">Qui a quoi ? Où est-il ? Puis-je l’utiliser samedi ?</p>
            {signedOut ? (
              <p class="notice notice-success" role="status">
                Vous êtes déconnecté. À bientôt !
              </p>
            ) : null}
            {databaseOk ? null : (
              <p class="notice notice-error">Le service est momentanément indisponible.</p>
            )}
            <p class="landing-actions">
              <a class="button large" href={routes.signUp.form.index.href()}>
                Rejoindre {appName}
              </a>
              <a class="button large secondary" href={routes.signIn.form.index.href()}>
                Se connecter
              </a>
            </p>
          </div>
          <footer class="landing-foot">
            <span>
              <Icon name="sheet" />
              Importez votre tableur (CSV)
            </span>
            <a href={sourceCodeUrl}>
              <Icon name="code" />
              Open source, licence MIT, sur GitHub
            </a>
            <span>
              <Icon name="heart" />
              Un projet Collecti’FROG
            </span>
            <a href={routes.legal.href()}>Mentions légales</a>
          </footer>
        </div>
      </Layout>
    )
  }
}

/** Legal notice: a placeholder until V1.0 writes it with the GDPR work (US-0.10.24). */
export function LegalPage(handle: Handle<{ viewer: Viewer }>) {
  return () => (
    <Layout title="Mentions légales" viewer={handle.props.viewer}>
      <h1>Mentions légales</h1>
      <p>Cette page est en cours de construction.</p>
      <p>
        <a href={routes.home.href()}>Retour à l’accueil</a>
      </p>
    </Layout>
  )
}
