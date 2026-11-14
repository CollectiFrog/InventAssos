import type { Handle } from 'remix/component'

import type { User } from '../../../data/tables.ts'
import { routes } from '../../../routes.ts'
import {
  CsrfField,
  ErrorSummary,
  type FieldErrors,
  SelectField,
  TextField,
} from '../../../ui/form.tsx'
import { Layout, type Viewer } from '../../../ui/layout.tsx'
import { AdminTabs, adminBack, adminTrail } from '../admin-tabs.tsx'

/** A platform role an admin gives in the app. */
export type StaffRole = 'moderator' | 'admin'

/** How each role reads in a sentence ("X est maintenant …"). */
export const staffRoleLabels: Record<StaffRole, string> = {
  moderator: 'modérateur',
  admin: 'administrateur',
}

/** One person of the team, with what the viewer may do. */
export interface TeamRow {
  user: User
  canRemove: boolean
  isYou: boolean
  /** Admin through PLATFORM_ADMIN_EMAILS: never removable from the app. */
  listed: boolean
}

/** Props of Administration › Équipe. */
export interface TeamPageProps {
  viewer: Viewer
  csrfToken: string
  listedAdmins: TeamRow[]
  namedAdmins: TeamRow[]
  moderators: TeamRow[]
  values: Record<string, string>
  errors: FieldErrors
  notice?: string
}

/** A list of people of the team, each with « Retirer » when the viewer may take the role back. */
function TeamList(handle: Handle<{ rows: TeamRow[]; csrfToken: string; empty: string }>) {
  return () => {
    const { rows, csrfToken, empty } = handle.props
    if (rows.length === 0) return <p>{empty}</p>
    return (
      <ul class="cards">
        {rows.map(({ user, canRemove, isYou, listed }) => (
          <li key={user.id} class="card row">
            <span>
              <strong>{user.name}</strong> · {user.email}
              {isYou ? <span class="status"> · vous</span> : null}
              {listed ? <span class="status"> · par la configuration</span> : null}
              {user.status === 'active' ? null : <span class="status"> · désactivé</span>}
            </span>
            {canRemove ? (
              <form method="post" action={routes.admin.team.remove.href({ userId: user.id })}>
                <CsrfField token={csrfToken} />
                <button type="submit" class="danger">
                  Retirer
                </button>
              </form>
            ) : null}
          </li>
        ))}
      </ul>
    )
  }
}

/**
 * Administration › Équipe (US-0.8.1, US-0.10.7): admins and moderators, each removable by an admin
 * unless listed in the configuration or oneself, and a form to name one.
 */
export function TeamPage(handle: Handle<TeamPageProps>) {
  return () => {
    const { viewer, csrfToken, listedAdmins, namedAdmins, moderators, values, errors, notice } =
      handle.props
    return (
      <Layout
        title="Équipe"
        viewer={viewer}
        headerLink="account"
        trail={adminTrail}
        back={adminBack}
      >
        <h1>Administration</h1>
        <AdminTabs current="team" viewer={viewer} />
        {notice ? (
          <p class="notice notice-success" role="status">
            {notice}
          </p>
        ) : null}
        <ErrorSummary errors={errors} />
        <h2 id="administrateurs">Administrateurs</h2>
        <p>
          Les administrateurs ont tous les droits de la plateforme et composent l’équipe. Ceux de la
          configuration du serveur ne peuvent pas être retirés ici.
        </p>
        <TeamList
          rows={[...listedAdmins, ...namedAdmins]}
          csrfToken={csrfToken}
          empty="Aucun administrateur."
        />
        <h2 id="moderateurs">Modérateurs</h2>
        <p>
          Les modérateurs traitent les demandes, désactivent ou réactivent des comptes, gèrent les
          catégories et retirent du matériel abusif. Ils ne peuvent agir ni sur un administrateur ni
          sur un autre modérateur.
        </p>
        <TeamList
          rows={moderators}
          csrfToken={csrfToken}
          empty="Aucun modérateur pour l’instant."
        />
        <h2 id="nommer">Ajouter à l’équipe</h2>
        <form method="post" action={routes.admin.team.name.href()} class="stack">
          <CsrfField token={csrfToken} />
          <TextField
            name="email"
            label="Adresse e-mail"
            type="email"
            value={values.email}
            error={errors.email}
            required
            autoComplete="off"
            maxLength={254}
            hint="Celle d’un compte validé. La personne garde son matériel et ses collectifs."
          />
          <SelectField
            name="role"
            label="Rôle"
            value={values.role ?? 'moderator'}
            error={errors.role}
            required
            options={[
              { value: 'moderator', label: 'Modérateur' },
              { value: 'admin', label: 'Administrateur' },
            ]}
          />
          <button type="submit">Nommer</button>
        </form>
      </Layout>
    )
  }
}
