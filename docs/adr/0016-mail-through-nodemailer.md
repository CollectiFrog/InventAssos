---
title: "0016: E-mail through nodemailer, logged outside production"
description: One Mailer interface; SMTP in production, the log or Mailpit in development, memory in tests.
---

| Status   | Date       | Deciders              |
|----------|------------|-----------------------|
| Proposed | 2026-11-08 | @claude (nightly run) |

## Context

Sign-in links and admin notifications go out by e-mail through the Collecti'FROG Zimbra SMTP
(ADR 0008). Remix 3 ships no mail package. Contributors and CI have no SMTP credentials and must
never send real e-mails.

## Decision

- The app depends on a small `Mailer` interface (`app/mail/mailer.ts`), passed to the router.
- Production: `createSmtpMailer(SMTP_URL, MAIL_FROM)` with **nodemailer**. `SMTP_URL` is a secret
  (`smtps://user:password@host:465`); the app refuses to start in production without it.
- Development: without `SMTP_URL`, e-mails are printed to the server log. `make db` also starts
  Mailpit, which catches them on `smtp://localhost:1025` with a web UI on `:8025`.
- Tests: an in-memory mailer whose `outbox` the tests read.
- A failed send is logged and never fails the user's request (`sendSafely`).

## Alternatives

| Option                            | Pros             | Cons                                      | Why not                               |
|-----------------------------------|------------------|-------------------------------------------|---------------------------------------|
| Hand-written SMTP client          | no dependency    | TLS, auth, encoding, retries to get right | security-sensitive, easy to get wrong |
| HTTP e-mail API (Brevo, Mailjet…) | delivery reports | third party holds the e-mails, account    | Zimbra is already there               |

## Consequences

- One runtime dependency: `nodemailer` (MIT-0, no dependencies, maintained since 2010).
- E-mails are plain text in French (`app/mail/messages.ts`).
- Delivery is fire-and-forget: a queue with retries can come later if e-mails get lost.
