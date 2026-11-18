---
title: "0036: The validation e-mail opens « choose your password »"
description: Validating an account e-mails a 7-day password link, so a new user chooses a password without asking for another e-mail.
---

| Status   | Date       | Deciders   |
|----------|------------|------------|
| Accepted | 2026-11-18 | @tritriper |

Supersedes the point of [0029](../0029-password-sign-in/) that a password is first created only on
request; its rules, storage and limits stand.

## Context

Under [0029](../0029-password-sign-in/), the e-mail that validates an account linked to the sign-in
page. A new user who wanted a password had to find « Mot de passe oublié ou pas encore créé ? »,
type their address again and wait for a second e-mail. In the field, a tester read the validation
e-mail, landed on the sign-in page and called it « une étape en trop qui ne sert à rien ».

## Decision

- **Validating an account creates a password link** for the person (purpose `password_reset`) and
  the « compte validé » e-mail carries it, with the sign-in page as the other way in.
- **It lasts 7 days**, not 30 minutes: the validation e-mail is often read days later. It stays
  single use, and choosing a password uses up the person's other password links, as before.
- **GET shows the form, POST uses the link** (0029): mail scanners such as Outlook Safe Links open
  links before the person does, and would otherwise burn it.
- An expired or used link shows « Ce lien ne fonctionne plus » with « Demander un nouveau lien ».

## Alternatives

| Option                                   | Pros                          | Cons                                                  | Why not                               |
|------------------------------------------|-------------------------------|-------------------------------------------------------|---------------------------------------|
| Password chosen at sign-up               | ready at validation           | stored before anyone checked the address or the person | 0029 rejected it for the same reason  |
| Link to « Mot de passe oublié ? » page   | no new token                  | still a second e-mail                                 | the step the tester complained about  |
| Sign-in link that also asks a password   | one link                      | GET would have to sign in: scanners burn it           | the form must survive a prefetch      |
| A distinct `welcome` token purpose       | the page could greet the user | a migration for a different title                     | same form, same rules: one purpose    |

## Consequences

- A password link may now live 7 days. It only opens the form; the account was validated by an
  admin or a moderator, and the address received the e-mail, as for any reset link.
- The approval creates the token in the same transaction as the status change.
- `createSignInToken` takes an optional lifetime; the welcome lifetime is `welcomeTokenTtlMs`.
