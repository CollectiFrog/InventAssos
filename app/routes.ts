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
  },
  admin: {
    accounts: get('/admin/comptes'),
    approveAccount: post('/admin/comptes/:userId/accepter'),
    rejectAccount: post('/admin/comptes/:userId/refuser'),
    disableAccount: post('/admin/comptes/:userId/desactiver'),
    collectifs: {
      approve: post('/admin/collectifs/:collectifId/accepter'),
      reject: post('/admin/collectifs/:collectifId/refuser'),
    },
  },
  signUp: {
    form: form('/inscription'),
    sent: get('/inscription/envoyee'),
  },
})
