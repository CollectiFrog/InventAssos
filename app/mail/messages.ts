// Texts of the e-mails the app sends, in French (the users' language).
import type { Mail } from './mailer.ts'

const signature = "\n\n— InventAssos, l'inventaire partagé entre associations"

/** To the platform admins: a new account waits for approval. */
export function newAccountRequestMail(to: string[], reviewUrl: string): Mail {
  return {
    to,
    subject: 'Nouvelle demande de compte',
    text: `Une nouvelle demande de compte attend votre validation :\n${reviewUrl}${signature}`,
  }
}

/** To the person who signed up: the request is recorded. */
export function signUpReceivedMail(to: string, appUrl: string): Mail {
  return {
    to,
    subject: 'Votre demande de compte InventAssos',
    text:
      'Bonjour,\n\nVotre demande de compte est enregistrée. Un administrateur va l’examiner ; ' +
      `vous recevrez un e-mail quand ce sera fait.\n\n${appUrl}${signature}`,
  }
}

/** To an address that already has an account: someone tried to sign up again with it. */
export function alreadyRegisteredMail(to: string, appUrl: string): Mail {
  return {
    to,
    subject: 'Vous avez déjà un compte InventAssos',
    text:
      'Bonjour,\n\nQuelqu’un (sans doute vous) a demandé à créer un compte avec cette adresse, ' +
      'mais elle en a déjà un : aucun nouveau compte n’a été créé. ' +
      `Si ce n’était pas vous, ignorez ce message.\n\n${appUrl}${signature}`,
  }
}
