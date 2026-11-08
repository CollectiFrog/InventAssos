// Outgoing e-mail. The transport is chosen from the configuration (ADR 0016).
import nodemailer from 'nodemailer'

/** One plain-text e-mail. */
export interface Mail {
  to: string | string[]
  subject: string
  text: string
  /** Where answers go, e.g. the person who wrote through the contact form. */
  replyTo?: string
}

/** Sends e-mails; the app depends on this interface, never on a transport. */
export interface Mailer {
  send(mail: Mail): Promise<void>
}

/** SMTP mailer (the Collecti'FROG Zimbra in production), configured by an `smtp(s)://` URL. */
export function createSmtpMailer(smtpUrl: string, from: string): Mailer {
  const transport = nodemailer.createTransport(smtpUrl)
  return {
    async send(mail) {
      await transport.sendMail({
        from,
        to: mail.to,
        replyTo: mail.replyTo,
        subject: mail.subject,
        text: mail.text,
      })
    },
  }
}

/** Development mailer: writes each e-mail to the server log instead of sending it. */
export function createLogMailer(log: (line: string) => void = console.log): Mailer {
  return {
    async send(mail) {
      const to = Array.isArray(mail.to) ? mail.to.join(', ') : mail.to
      const replyTo = mail.replyTo ? `\n[mail] Reply-To: ${mail.replyTo}` : ''
      log(`[mail] To: ${to}${replyTo}\n[mail] Subject: ${mail.subject}\n${mail.text}\n[mail] ---`)
    },
  }
}

/** Sends without failing the request: a lost notification must not lose the user's action. */
export async function sendSafely(mailer: Mailer, mail: Mail): Promise<void> {
  try {
    await mailer.send(mail)
  } catch (error) {
    console.error(`[mail] could not send "${mail.subject}"`, error)
  }
}
