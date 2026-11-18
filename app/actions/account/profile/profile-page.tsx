import type { Handle } from 'remix/component'
import { appName, appVersion } from '../../../brand.ts'
import { routes } from '../../../routes.ts'
import { ErrorSummary, type FieldErrors } from '../../../ui/form.tsx'
import { Layout, SignOutButton, ThemeSwitch, type Viewer } from '../../../ui/layout.tsx'
import { EditableSettingRow, SettingRow } from '../../../ui/settings.tsx'

/** The public user guide. */
const guideUrl = 'https://collectifrog.github.io/InventAssos/'

/** The rows of Mon compte edited in place, as `?modifier=` names them (ADR 0034). */
export const editableRows = ['nom', 'telephone'] as const
export type EditableRow = (typeof editableRows)[number]

/** Props of Mon compte. */
export interface ProfilePageProps {
  viewer: Viewer
  csrfToken: string
  email: string
  values: { name: string; phone: string }
  /** The person's collectifs, linked from their row. */
  collectifs: readonly { name: string; slug: string; city: string }[]
  /** Whether the person has chosen a password (US-0.10.8). */
  hasPassword: boolean
  /** The row showing its field instead of its value, if any. */
  editing?: EditableRow
  errors?: FieldErrors
  saved?: boolean
}

/** Mon compte (US-0.2.6, US-0.10.13): one column of rows, the profile first, deletion last. */
export function ProfilePage(handle: Handle<ProfilePageProps>) {
  return () => {
    const {
      viewer,
      csrfToken,
      email,
      values,
      collectifs,
      hasPassword,
      editing,
      errors = {},
      saved,
    } = handle.props
    const page = routes.account.profile.index.href()
    const row = {
      action: routes.account.profile.action.href(),
      csrfToken,
      cancelHref: page,
    }
    return (
      <Layout title="Mon compte" viewer={viewer} headerLink="account">
        <h1>Mon compte</h1>
        {saved ? (
          <p class="notice notice-success" role="status">
            Profil enregistré.
          </p>
        ) : null}
        <ErrorSummary errors={errors} />
        <div class="setting-rows" id="profil">
          <SettingRow id="e-mail" label="Adresse e-mail" value={email} />
          <EditableSettingRow
            {...row}
            id="nom"
            label="Nom et prénom"
            value={values.name}
            empty="Non renseigné"
            editing={editing === 'nom' || Boolean(errors.name)}
            editHref={`${page}?modifier=nom#nom`}
            name="name"
            required
            autoComplete="name"
            maxLength={120}
            error={errors.name}
          />
          <EditableSettingRow
            {...row}
            id="telephone"
            label="Téléphone"
            value={values.phone}
            empty="Non partagé"
            editing={editing === 'telephone' || Boolean(errors.phone)}
            editHref={`${page}?modifier=telephone#telephone`}
            name="phone"
            type="tel"
            autoComplete="tel"
            maxLength={25}
            hint="Visible par les personnes de vos collectifs, pour qu’elles puissent vous joindre au sujet du matériel. Laissez vide pour ne pas le partager."
            error={errors.phone}
          />
        </div>
        <div class="setting-rows">
          <SettingRow id="apparence" label="Apparence">
            <ThemeSwitch csrfToken={csrfToken} theme={viewer?.theme ?? 'system'} />
          </SettingRow>
          <SettingRow
            id="collectifs"
            label="Mes collectifs"
            value={
              collectifs.length === 0
                ? 'Aucun pour l’instant'
                : collectifs.map((c, index) => (
                    <>
                      {index > 0 ? ', ' : null}
                      <a href={routes.collectifs.show.href({ slug: c.slug })}>{c.name}</a>
                    </>
                  ))
            }
          >
            <a class="button secondary small" href={routes.collectifs.index.href()}>
              Rejoindre ou déclarer
            </a>
          </SettingRow>
          <SettingRow
            id="mot-de-passe"
            label="Mot de passe"
            value={hasPassword ? 'Défini' : 'Aucun'}
          >
            <a class="button secondary small" href={routes.password.request.index.href()}>
              {hasPassword ? 'Changer' : 'Choisir'}
            </a>
          </SettingRow>
          <SettingRow id="session" label="Session">
            <SignOutButton csrfToken={csrfToken} small />
          </SettingRow>
          <SettingRow
            id="supprimer"
            label="Supprimer mon compte"
            value="Votre accès s’arrête ; vos données sont effacées ensuite."
          >
            <a class="button danger small" href={routes.account.deletion.href()}>
              Supprimer…
            </a>
          </SettingRow>
        </div>
        <p class="setting-foot" id="a-propos">
          {appName}, version {appVersion} · <a href={guideUrl}>Guide d’utilisation</a>
        </p>
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
