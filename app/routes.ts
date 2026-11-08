import { form, get, route } from 'remix/routes'

/** The URL contract of the application: every link, form and redirect is built from it. */
export const routes = route({
  home: '/',
  health: {
    live: get('/healthz'),
    ready: get('/readyz'),
  },
  signUp: {
    form: form('/inscription'),
    sent: get('/inscription/envoyee'),
  },
})
