---
title: "0029: Password sign-in next to the e-mail link"
description: An optional password, hashed with scrypt, chosen only through an e-mailed link.
---

| Status   | Date       | Deciders   |
|----------|------------|------------|
| Accepted | 2026-11-13 | @tritriper |

Supersedes [0008](../0008-app-managed-accounts/).

## Context

[ADR 0008](../0008-app-managed-accounts/) chose app-managed accounts with a single-use e-mailed
link and no password. In the field, people want to sign in without waiting for an e-mail, and some
mail services open links before the person does (the link now signs in at once, US-0.10.6), which
uses the link up. App-managed accounts and the later OIDC option stand.

## Decision

A person may add a **password**; the e-mailed link keeps working for everyone.

- A password is created or changed **only through an e-mailed link** ("Mot de passe oublié ou pas
  encore créé ?", or Mon compte › Mot de passe): one flow to secure, and the e-mail proves the
  owner. The link opens a form (GET does not use it), valid 30 minutes, single use; choosing a
  password uses up the person's other password links.
- **Rules**: 12 to 128 characters, no composition rule (CNIL and ANSSI favour length).
- **Storage**: scrypt from `node:crypto` (no new dependency), N=2^15, r=8, p=3 (an OWASP profile,
  32 MiB per hash, within the pod's 384 MiB), 16-byte salt; the parameters are stored with the hash
  so they can be raised later. Text is NFC-normalised first.
- **Sign-in**: the same e-mail field serves both; one answer for an unknown address, a wrong
  password or an account without one, and the hash work is done in every case.
- **Limits**: 10 tries per address per hour, right or wrong, besides the 20 forms per client per
  15 minutes ([ADR 0018](../0018-rate-limits-in-postgresql/)).
- **On change**: every other session is closed, the person is signed in, and an e-mail tells them
  the password changed, with a link to choose another. The audit log records `user.password_set`
  with IDs only.
- No second factor, admins and moderators included.

## Alternatives

| Option                                 | Pros                        | Cons                                          | Why not                                |
|----------------------------------------|-----------------------------|-----------------------------------------------|----------------------------------------|
| Password instead of the link           | one way in                  | forgotten passwords, a reset flow anyway      | the link works well for most people    |
| Password chosen at sign-up             | ready from day one          | a second form to secure, unverified at first  | the reset link already proves the mail |
| argon2id (npm package or `crypto`)     | memory-hard, OWASP's first  | a native dependency, or an experimental API   | scrypt is stable and built in          |
| Second factor for staff                | protects the widest rights  | more screens; staff already few and known     | the maintainer declined it             |

## Consequences

- `users.password_hash` and `sign_in_tokens.purpose` (migration 0019); a sign-in token never works
  as a password token, nor the reverse.
- Someone who knows the address can block password sign-in for an hour with wrong tries; the
  e-mailed link still works.
- A password is personal data: it goes with the account when V1.0 deletes it (ADR 0010).
