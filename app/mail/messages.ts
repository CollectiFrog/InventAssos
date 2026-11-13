// Texts of the e-mails the app sends, in French (the users' language).

import { appName } from '../brand.ts'
import type { Mail } from './mailer.ts'

const signature = `\n\n— ${appName}, l'inventaire partagé entre associations`

/** To the platform admins: a new account waits for approval. */
export function newAccountRequestMail(to: string[], reviewUrl: string): Mail {
  return {
    to,
    subject: 'Nouvelle demande de compte',
    text: `Au moins une nouvelle demande de compte attend votre validation :\n${reviewUrl}${signature}`,
  }
}

/** To the person who signed up: the request is recorded. */
export function signUpReceivedMail(to: string, appUrl: string): Mail {
  return {
    to,
    subject: `Votre demande de compte ${appName}`,
    text:
      'Bonjour,\n\nVotre demande de compte est enregistrée. Un administrateur ou un modérateur va l’examiner ; ' +
      `vous recevrez un e-mail quand ce sera fait.\n\n${appUrl}${signature}`,
  }
}

/** To a user who asked to sign in: the single-use link. */
export function signInLinkMail(to: string, linkUrl: string): Mail {
  return {
    to,
    subject: `Votre lien de connexion ${appName}`,
    text:
      `Bonjour,\n\nPour vous connecter, ouvrez ce lien dans les 15 minutes :\n${linkUrl}\n\n` +
      `Il ne fonctionne qu’une fois. Si vous n’avez rien demandé, ignorez ce message.${signature}`,
  }
}

/** To the person: the link to choose a password, or a new one (ADR 0029). */
export function passwordResetMail(to: string, linkUrl: string): Mail {
  return {
    to,
    subject: `Choisir votre mot de passe ${appName}`,
    text:
      `Bonjour,\n\nPour choisir votre mot de passe, ouvrez ce lien dans les 30 minutes :\n${linkUrl}\n\n` +
      'Il ne fonctionne qu’une fois. Si vous n’avez rien demandé, ignorez ce message : votre ' +
      `mot de passe actuel, si vous en avez un, ne change pas.${signature}`,
  }
}

/** To the person: their password was just set; the only sign that someone else did it. */
export function passwordChangedMail(to: string, resetUrl: string): Mail {
  return {
    to,
    subject: `Votre mot de passe ${appName} a été modifié`,
    text:
      'Bonjour,\n\nLe mot de passe de votre compte vient d’être choisi ou modifié, et vos autres ' +
      'sessions ont été fermées.\n\nSi ce n’est pas vous, choisissez-en un nouveau tout de suite :\n' +
      `${resetUrl}\n\npuis prévenez un administrateur.${signature}`,
  }
}

/** To an address that already has an account: someone tried to sign up again with it. */
export function alreadyRegisteredMail(to: string, signInUrl: string): Mail {
  return {
    to,
    subject: `Vous avez déjà un compte ${appName}`,
    text:
      'Bonjour,\n\nQuelqu’un (sans doute vous) a demandé à créer un compte avec cette adresse, ' +
      'mais elle en a déjà un : aucun nouveau compte n’a été créé. ' +
      `Pour vous connecter :\n${signInUrl}\n\nSi ce n’était pas vous, ignorez ce message.${signature}`,
  }
}

/** To a rejected address that signed up again: only its owner may re-apply, once signed in. */
export function reapplyBySignInMail(to: string, signInUrl: string): Mail {
  return {
    to,
    subject: `Votre demande de compte ${appName}`,
    text:
      'Bonjour,\n\nQuelqu’un (sans doute vous) a demandé un compte avec cette adresse. Une ' +
      'demande précédente n’avait pas été acceptée. Pour en refaire une, connectez-vous avec ' +
      `cette adresse puis choisissez « Refaire une demande » :\n${signInUrl}\n\n` +
      `Si ce n’était pas vous, ignorez ce message.${signature}`,
  }
}

/** To the person: their account is open. */
export function accountApprovedMail(to: string, signInUrl: string): Mail {
  return {
    to,
    subject: `Votre compte ${appName} est validé`,
    text: `Bonjour,\n\nVotre compte est validé : vous pouvez vous connecter.\n${signInUrl}${signature}`,
  }
}

/** To the person: their request was rejected, with the admin's reason if any. */
export function accountRejectedMail(to: string, reason: string | null): Mail {
  return {
    to,
    subject: `Votre demande de compte ${appName}`,
    text:
      'Bonjour,\n\nVotre demande de compte n’a pas été acceptée.' +
      (reason ? `\n\nMotif : ${reason}` : '') +
      '\n\nSi la situation change, vous pouvez refaire une demande en vous connectant.' +
      signature,
  }
}

/** To the platform admins: a collectif or a responsible request waits for a decision. */
export function newCollectifRequestMail(to: string[], reviewUrl: string): Mail {
  return {
    to,
    subject: 'Nouvelle demande de collectif',
    text: `Au moins une nouvelle demande de collectif attend votre validation :\n${reviewUrl}${signature}`,
  }
}

/** To the requester: their collectif is open and they are its responsible. */
export function collectifApprovedMail(to: string, collectifName: string, appUrl: string): Mail {
  return {
    to,
    subject: `Collectif « ${collectifName} » validé`,
    text:
      `Bonjour,\n\nLe collectif « ${collectifName} » est validé et vous en êtes responsable : ` +
      `vous pouvez gérer ses informations et, bientôt, son matériel.\n${appUrl}${signature}`,
  }
}

/** To the requester: their collectif request was rejected. */
export function collectifRejectedMail(
  to: string,
  collectifName: string,
  reason: string | null,
): Mail {
  return {
    to,
    subject: `Demande de collectif « ${collectifName} »`,
    text:
      `Bonjour,\n\nVotre demande pour le collectif « ${collectifName} » n’a pas été acceptée.` +
      (reason ? `\n\nMotif : ${reason}` : '') +
      signature,
  }
}

/** To the platform admins: someone asks to manage a collectif. */
export function newResponsibleRequestMail(to: string[], reviewUrl: string): Mail {
  return {
    to,
    subject: 'Nouvelle demande de responsable',
    text: `Au moins une personne demande à devenir responsable d’un collectif :\n${reviewUrl}${signature}`,
  }
}

/** To the person: they now manage the collectif. */
export function responsibleApprovedMail(to: string, collectifName: string, appUrl: string): Mail {
  return {
    to,
    subject: `Vous êtes responsable de « ${collectifName} »`,
    text: `Bonjour,\n\nVotre demande est acceptée : vous êtes responsable du collectif « ${collectifName} ».\n${appUrl}${signature}`,
  }
}

/** To the person: their request to manage the collectif was rejected. */
export function responsibleRejectedMail(to: string, collectifName: string): Mail {
  return {
    to,
    subject: `Demande de responsable pour « ${collectifName} »`,
    text: `Bonjour,\n\nVotre demande pour devenir responsable du collectif « ${collectifName} » n’a pas été acceptée.${signature}`,
  }
}

/** To an item's owner: a validated user writes about it through the contact form (US-0.6.3). */
export function itemContactMail(input: {
  to: string
  senderName: string
  senderEmail: string
  itemName: string
  itemUrl: string
  message: string
}): Mail {
  return {
    to: input.to,
    replyTo: input.senderEmail,
    subject: `À propos de « ${input.itemName} »`,
    text:
      `Bonjour,\n\n${input.senderName} (${input.senderEmail}) vous écrit au sujet de ` +
      `« ${input.itemName} » :\n${input.itemUrl}\n\n---\n${input.message}\n---\n\n` +
      'Répondez directement à cet e-mail pour lui écrire.' +
      signature,
  }
}

/** To an item's owner (or its collectif's responsibles): a moderator archived it (US-0.8.2). */
export function itemModeratedMail(input: {
  to: string
  itemName: string
  itemUrl: string
  message: string
}): Mail {
  return {
    to: input.to,
    subject: `« ${input.itemName} » retiré par la modération`,
    text:
      `Bonjour,\n\nLa modération d’${appName} a retiré « ${input.itemName} » de l’inventaire. ` +
      `Il est archivé : sa page et son historique restent visibles.\n${input.itemUrl}\n\n` +
      `Motif :\n---\n${input.message}\n---` +
      signature,
  }
}

/** To one responsible: someone asks to join their collectif (US-0.8.3). */
export function membershipRequestMail(input: {
  to: string
  personName: string
  collectifName: string
  membersUrl: string
}): Mail {
  return {
    to: input.to,
    subject: `Demande pour rejoindre « ${input.collectifName} »`,
    text:
      `Bonjour,\n\n${input.personName} demande à rejoindre le collectif « ${input.collectifName} ». ` +
      `Acceptez ou refusez sa demande dans l’onglet Membres :\n${input.membersUrl}${signature}`,
  }
}

/** To the person: a responsible accepted them as a member (US-0.8.4). */
export function membershipApprovedMail(to: string, collectifName: string, url: string): Mail {
  return {
    to,
    subject: `Bienvenue dans « ${collectifName} »`,
    text:
      `Bonjour,\n\nVous êtes maintenant membre du collectif « ${collectifName} » : vous voyez son ` +
      `matériel, ses lieux et ses membres.\n${url}${signature}`,
  }
}

/** To the person: a responsible rejected their request to join (US-0.8.4). */
export function membershipRejectedMail(to: string, collectifName: string): Mail {
  return {
    to,
    subject: `Demande pour rejoindre « ${collectifName} »`,
    text: `Bonjour,\n\nVotre demande pour rejoindre le collectif « ${collectifName} » n’a pas été acceptée.${signature}`,
  }
}

/** To the person: a responsible removed them from the collectif (US-0.8.4). */
export function membershipRemovedMail(to: string, collectifName: string): Mail {
  return {
    to,
    subject: `Vous n’êtes plus membre de « ${collectifName} »`,
    text: `Bonjour,\n\nUn responsable vous a retiré du collectif « ${collectifName} ».${signature}`,
  }
}

/** To the person: a responsible or the platform made them responsible of the collectif (US-0.8.6). */
export function responsibleNamedMail(to: string, collectifName: string, url: string): Mail {
  return {
    to,
    subject: `Vous êtes responsable de « ${collectifName} »`,
    text:
      `Bonjour,\n\nVous êtes maintenant responsable du collectif « ${collectifName} » : vous gérez ` +
      `ses lieux, ses membres et sa présentation.\n${url}${signature}`,
  }
}

/** To the person: they are no longer responsible, and stay a member (US-0.8.6). */
export function responsibleDemotedMail(to: string, collectifName: string): Mail {
  return {
    to,
    subject: `Vous n’êtes plus responsable de « ${collectifName} »`,
    text:
      `Bonjour,\n\nVous n’êtes plus responsable du collectif « ${collectifName} ». Vous en restez ` +
      `membre : vous voyez et tenez à jour son matériel.${signature}`,
  }
}

/** To an item's owner (or its collectif's responsibles): the platform deleted it for good. */
export function itemDeletedByPlatformMail(input: {
  to: string
  itemName: string
  message: string
}): Mail {
  return {
    to: input.to,
    subject: `« ${input.itemName} » supprimé par la modération`,
    text:
      `Bonjour,\n\nLa modération d’${appName} a supprimé « ${input.itemName} » de l’inventaire. ` +
      `La suppression est définitive : l’objet et son historique n’existent plus.\n\n` +
      `Motif :\n---\n${input.message}\n---` +
      signature,
  }
}
