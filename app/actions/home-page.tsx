import type { Handle } from 'remix/component'

import { routes } from '../routes.ts'
import { Layout, type Viewer } from '../ui/layout.tsx'

/** Home page; shows whether the database answers so a fresh install can be checked at a glance. */
export function HomePage(handle: Handle<{ databaseOk: boolean; viewer: Viewer }>) {
  return () => {
    const { databaseOk, viewer } = handle.props
    return (
      <Layout title="Accueil" viewer={viewer} section="home">
        <h1>{viewer ? `Bonjour ${viewer.name}` : 'InventAssos'}</h1>
        <p>
          Inventaire de matériel partagé entre associations : chaque collectif référence son
          matériel, les autres le trouvent et contactent le propriétaire.
        </p>
        {viewer ? (
          <p class="actions">
            <a class="button" href={routes.inventory.index.href()}>
              Rechercher dans mes collectifs
            </a>
            <a class="button secondary" href={routes.items.index.href()}>
              Mon matériel
            </a>
          </p>
        ) : (
          <p class="actions">
            <a class="button" href={routes.signIn.form.index.href()}>
              Se connecter
            </a>
            <a class="button secondary" href={routes.signUp.form.index.href()}>
              Créer un compte
            </a>
          </p>
        )}
        <p class="status">Base de données : {databaseOk ? 'connectée' : 'injoignable'}</p>
      </Layout>
    )
  }
}
