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
    link: get('/connexion/lien/:token'),
    password: post('/connexion/mot-de-passe'),
  },
  password: {
    request: form('/mot-de-passe'),
    sent: get('/mot-de-passe/envoye'),
    choose: form('/mot-de-passe/nouveau/:token'),
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
    people: get('/collectifs/:slug/membres'),
    /** The tab's address until V0.7, kept for bookmarks: redirects to `people`. */
    oldPeople: get('/collectifs/:slug/responsables'),
    edit: form('/collectifs/:slug/modifier'),
    requestResponsibility: post('/collectifs/:slug/devenir-responsable'),
    join: post('/collectifs/:slug/rejoindre'),
    members: {
      approve: post('/collectifs/:slug/membres/:userId/accepter'),
      reject: post('/collectifs/:slug/membres/:userId/refuser'),
      remove: post('/collectifs/:slug/membres/:userId/retirer'),
      promote: post('/collectifs/:slug/membres/:userId/nommer-responsable'),
      demote: post('/collectifs/:slug/membres/:userId/retirer-responsable'),
      leave: post('/collectifs/:slug/quitter'),
    },
    deletions: {
      approve: post('/collectifs/:slug/suppressions/:itemId/accepter'),
      reject: post('/collectifs/:slug/suppressions/:itemId/refuser'),
    },
  },
  inventory: {
    index: get('/inventaire'),
  },
  imports: {
    start: form('/import'),
    columns: form('/import/:importId/colonnes'),
    values: form('/import/:importId/valeurs'),
    preview: form('/import/:importId/apercu'),
    cancel: post('/import/:importId/abandonner'),
  },
  exports: {
    collectif: post('/collectifs/:slug/exporter'),
    mine: post('/materiel/exporter'),
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
    remove: form('/materiel/:itemId/supprimer'),
    contact: post('/materiel/:itemId/contacter'),
    requestDeletion: post('/materiel/:itemId/demander-suppression'),
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
    team: {
      index: get('/admin/equipe'),
      name: post('/admin/equipe'),
      remove: post('/admin/equipe/:userId/retirer'),
    },
    /** The Modérateurs tab until V0.10, kept for bookmarks: redirects to `team`. */
    oldModerators: get('/admin/moderateurs'),
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
