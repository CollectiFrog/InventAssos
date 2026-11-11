import type { Handle, RemixNode } from 'remix/component'

import { routes } from '../../../routes.ts'
import { CsrfField, ErrorSummary, type FieldErrors, TextField } from '../../../ui/form.tsx'
import { Layout, SignOutButton, type Viewer } from '../../../ui/layout.tsx'

/** The public user guide. */
const guideUrl = 'https://collectifrog.github.io/InventAssos/'

/** Props of Mon compte. */
export interface ProfilePageProps {
  viewer: Viewer
  csrfToken: string
  email: string
  values: { name: string; phone: string }
  /** Collectifs the person is responsible of. */
  collectifs: readonly { name: string; slug: string; city: string }[]
  errors?: FieldErrors
  saved?: boolean
}

/** One section of a settings page: what it is for on the left, the card on the right. */
function SettingSection(
  handle: Handle<{
    id: string
    title: string
    text: string
    danger?: boolean
    children?: RemixNode
  }>,
) {
  return () => {
    const { id, title, text, danger, children } = handle.props
    return (
      <section id={id} class="setting" aria-labelledby={`${id}-titre`}>
        <div>
          <h2 id={`${id}-titre`}>{title}</h2>
          <p class="status">{text}</p>
        </div>
        <div class={danger ? 'card danger-zone' : 'card'}>{children}</div>
      </section>
    )
  }
}

const sections = [
  { id: 'profil', title: 'Profil' },
  { id: 'collectifs', title: 'Mes collectifs' },
  { id: 'session', title: 'Session' },
  { id: 'a-propos', title: 'À propos' },
  { id: 'supprimer', title: 'Supprimer mon compte' },
]

/** Mon compte (US-0.2.6, US-0.7.13), settings template: contents, then one section per topic. */
export function ProfilePage(handle: Handle<ProfilePageProps>) {
  return () => {
    const { viewer, csrfToken, email, values, collectifs, errors = {}, saved } = handle.props
    return (
      <Layout title="Mon compte" viewer={viewer} headerLink="account">
        <h1>Mon compte</h1>
        {saved ? (
          <p class="notice notice-success" role="status">
            Profil enregistré.
          </p>
        ) : null}
        <ErrorSummary errors={errors} />
        <div class="settings">
          <nav aria-label="Sur cette page" class="settings-toc">
            {sections.map((section) => (
              <a href={`#${section.id}`} class="toc-link">
                {section.title}
              </a>
            ))}
          </nav>
          <div class="settings-sections">
            <SettingSection
              id="profil"
              title="Profil"
              text="Ce que voient les personnes de vos collectifs."
            >
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
                  hint="Visible par les personnes de vos collectifs, pour qu’elles puissent vous joindre au sujet du matériel. Laissez vide pour ne pas le partager."
                />
                <button type="submit">Enregistrer</button>
              </form>
            </SettingSection>
            <SettingSection
              id="collectifs"
              title="Mes collectifs"
              text="Les collectifs dont vous êtes responsable."
            >
              {collectifs.length === 0 ? (
                <p>Vous ne faites encore partie d’aucun collectif.</p>
              ) : (
                <ul class="plain-list">
                  {collectifs.map((c) => (
                    <li>
                      <a href={routes.collectifs.show.href({ slug: c.slug })}>{c.name}</a>
                      {c.city ? <span class="status"> · {c.city}</span> : null}
                    </li>
                  ))}
                </ul>
              )}
              <p>
                <a href={routes.collectifs.index.href()}>Rejoindre ou déclarer un collectif</a>
              </p>
            </SettingSection>
            <SettingSection
              id="session"
              title="Session"
              text="Sur un appareil partagé, déconnectez-vous en partant."
            >
              <SignOutButton csrfToken={csrfToken} />
            </SettingSection>
            <SettingSection id="a-propos" title="À propos" text="InventAssos, version 0.7.">
              <p>
                <a href={guideUrl}>Guide d’utilisation</a>
              </p>
            </SettingSection>
            <SettingSection
              id="supprimer"
              title="Supprimer mon compte"
              text="Votre accès s’arrête ; vos données sont effacées ensuite."
              danger
            >
              <p>
                <a href={routes.account.deletion.href()}>Supprimer mon compte…</a>
              </p>
            </SettingSection>
          </div>
        </div>
      </Layout>
    )
  }
}

/** /compte/supprimer: what deleting will do. Deletion itself comes with V1.0 (US-1.0.4). */
export function DeleteAccountPage(handle: Handle<{ viewer: Viewer }>) {
  return () => (
    <Layout title="Supprimer mon compte" viewer={handle.props.viewer} headerLink="account">
      <h1>Supprimer mon compte</h1>
      <div class="notice">
        <p>
          <strong>Pas encore possible depuis l’application.</strong> La suppression du compte arrive
          avec la version 1.0.
        </p>
      </div>
      <div class="prose-block">
        <p>Quand elle sera disponible, supprimer votre compte :</p>
        <ul>
          <li>coupera votre accès tout de suite ;</li>
          <li>effacera vos données personnelles 2 à 3 mois plus tard, sauvegardes comprises ;</li>
          <li>
            ne laissera dans l’historique de la plateforme qu’un identifiant, jamais votre nom ni
            votre e-mail.
          </li>
        </ul>
        <p>
          En attendant, vous pouvez vider votre profil (téléphone) et demander la suppression à un
          administrateur de la plateforme.
        </p>
      </div>
      <p>
        <a class="button secondary" href={routes.account.profile.index.href()}>
          Retour à mon compte
        </a>
      </p>
    </Layout>
  )
}
