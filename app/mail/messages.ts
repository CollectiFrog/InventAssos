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

/** To a user who asked to sign in: the single-use link. */
export function signInLinkMail(to: string, linkUrl: string): Mail {
  return {
    to,
    subject: 'Votre lien de connexion InventAssos',
    text:
      `Bonjour,\n\nPour vous connecter, ouvrez ce lien dans les 15 minutes :\n${linkUrl}\n\n` +
      'Il ne fonctionne qu’une fois. Si vous n’avez rien demandé, ignorez ce message : ' +
      `personne ne peut se connecter sans ce lien.${signature}`,
  }
}

/** To an address that already has an account: someone tried to sign up again with it. */
export function alreadyRegisteredMail(to: string, signInUrl: string): Mail {
  return {
    to,
    subject: 'Vous avez déjà un compte InventAssos',
    text:
      'Bonjour,\n\nQuelqu’un (sans doute vous) a demandé à créer un compte avec cette adresse, ' +
      'mais elle en a déjà un : aucun nouveau compte n’a été créé. ' +
      `Pour vous connecter :\n${signInUrl}\n\nSi ce n’était pas vous, ignorez ce message.${signature}`,
  }
}

/** To the person: their account is open. */
export function accountApprovedMail(to: string, signInUrl: string): Mail {
  return {
    to,
    subject: 'Votre compte InventAssos est validé',
    text: `Bonjour,\n\nVotre compte est validé : vous pouvez vous connecter.\n${signInUrl}${signature}`,
  }
}

/** To the person: their request was rejected, with the admin's reason if any. */
export function accountRejectedMail(to: string, reason: string | null): Mail {
  return {
    to,
    subject: 'Votre demande de compte InventAssos',
    text:
      'Bonjour,\n\nVotre demande de compte n’a pas été acceptée.' +
      (reason ? `\n\nMotif : ${reason}` : '') +
      '\n\nSi la situation change, vous pouvez refaire une demande en vous connectant.' +
      signature,
  }
}
