import { form, get, post, route } from 'remix/routes'

/** The URL contract of the application: every link, form and redirect is built from it. */
export const routes = route({
  home: '/',
  health: {
    live: get('/healthz'),
    ready: get('/readyz'),
  },
  signIn: {
    form: form('/connexion'),
    sent: get('/connexion/envoyee'),
    link: form('/connexion/lien/:token'),
  },
  signOut: post('/deconnexion'),
  account: {
    profile: form('/compte/profil'),
    status: get('/compte/statut'),
    reapply: post('/compte/statut/redemander'),
  },
  collectifs: {
    index: get('/collectifs'),
    request: form('/collectifs/nouveau'),
    show: get('/collectifs/:slug'),
    edit: form('/collectifs/:slug/modifier'),
    requestResponsibility: post('/collectifs/:slug/devenir-responsable'),
  },
  inventory: {
    index: get('/inventaire'),
  },
  items: {
    index: get('/materiel'),
    create: form('/materiel/nouveau'),
    show: get('/materiel/:itemId'),
    edit: form('/materiel/:itemId/modifier'),
    move: form('/materiel/:itemId/deplacer'),
    archive: form('/materiel/:itemId/archiver'),
  },
  locations: {
    index: get('/lieux'),
    create: form('/lieux/nouveau'),
    edit: form('/lieux/:locationId/modifier'),
    remove: post('/lieux/:locationId/supprimer'),
    show: get('/lieux/:locationId'),
  },
  admin: {
    index: get('/admin'),
    approveAccount: post('/admin/comptes/:userId/accepter'),
    rejectAccount: post('/admin/comptes/:userId/refuser'),
    disableAccount: post('/admin/comptes/:userId/desactiver'),
    collectifs: {
      approve: post('/admin/collectifs/:collectifId/accepter'),
      reject: post('/admin/collectifs/:collectifId/refuser'),
    },
    responsibles: {
      approve: post('/admin/collectifs/:collectifId/responsables/:userId/accepter'),
      reject: post('/admin/collectifs/:collectifId/responsables/:userId/refuser'),
      remove: post('/admin/collectifs/:collectifId/responsables/:userId/retirer'),
    },
  },
  signUp: {
    form: form('/inscription'),
    sent: get('/inscription/envoyee'),
  },
})
