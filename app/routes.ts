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
    deletion: get('/compte/supprimer'),
    status: get('/compte/statut'),
    reapply: post('/compte/statut/redemander'),
  },
  collectifs: {
    index: get('/collectifs'),
    request: form('/collectifs/nouveau'),
    show: get('/collectifs/:slug'),
    places: get('/collectifs/:slug/lieux'),
    people: get('/collectifs/:slug/responsables'),
    edit: form('/collectifs/:slug/modifier'),
    requestResponsibility: post('/collectifs/:slug/devenir-responsable'),
  },
  inventory: {
    index: get('/inventaire'),
  },
  people: {
    show: get('/personnes/:userId'),
  },
  items: {
    index: get('/materiel'),
    create: form('/materiel/nouveau'),
    show: get('/materiel/:itemId'),
    edit: form('/materiel/:itemId/modifier'),
    move: form('/materiel/:itemId/deplacer'),
    archive: form('/materiel/:itemId/archiver'),
    contact: post('/materiel/:itemId/contacter'),
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
    requests: get('/admin/demandes'),
    accounts: get('/admin/comptes'),
    approveAccount: post('/admin/comptes/:userId/accepter'),
    rejectAccount: post('/admin/comptes/:userId/refuser'),
    disableAccount: post('/admin/comptes/:userId/desactiver'),
    enableAccount: post('/admin/comptes/:userId/reactiver'),
    collectifs: {
      index: get('/admin/collectifs'),
      approve: post('/admin/collectifs/:collectifId/accepter'),
      reject: post('/admin/collectifs/:collectifId/refuser'),
    },
    moderators: {
      index: get('/admin/moderateurs'),
      name: post('/admin/moderateurs'),
      remove: post('/admin/moderateurs/:userId/retirer'),
    },
    categories: {
      index: get('/admin/categories'),
      create: post('/admin/categories'),
      rename: post('/admin/categories/:categoryId/renommer'),
      up: post('/admin/categories/:categoryId/monter'),
      down: post('/admin/categories/:categoryId/descendre'),
      remove: post('/admin/categories/:categoryId/supprimer'),
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
