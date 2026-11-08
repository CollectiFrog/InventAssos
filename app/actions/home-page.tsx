import type { Handle } from 'remix/component'

import { routes } from '../routes.ts'
import { Layout } from '../ui/layout.tsx'

/** Home page; shows whether the database answers so a fresh install can be checked at a glance. */
export function HomePage(handle: Handle<{ databaseOk: boolean }>) {
  return () => (
    <Layout title="Accueil">
      <h1>InventAssos</h1>
      <p>
        Inventaire de matériel partagé entre associations : chaque collectif référence son matériel,
        les autres le trouvent et contactent le propriétaire.
      </p>
      <p>
        <a class="button" href={routes.signUp.form.index.href()}>
          Créer un compte
        </a>
      </p>
      <p class="status">
        Base de données : {handle.props.databaseOk ? 'connectée' : 'injoignable'}
      </p>
    </Layout>
  )
}
