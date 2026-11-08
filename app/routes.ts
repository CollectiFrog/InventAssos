import { form, get, route } from 'remix/routes'

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
  signUp: {
    form: form('/inscription'),
    sent: get('/inscription/envoyee'),
  },
})
