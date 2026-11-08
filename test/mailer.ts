// In-memory mailer for tests: e-mails are kept in `outbox` instead of being sent.
import type { Mail, Mailer } from '../app/mail/mailer.ts'

/** A Mailer whose sent e-mails can be inspected. */
export interface TestMailer extends Mailer {
  outbox: Mail[]
}

/** Creates an empty in-memory mailer. */
export function createTestMailer(): TestMailer {
  const outbox: Mail[] = []
  return {
    outbox,
    async send(mail) {
      outbox.push(mail)
    },
  }
}
