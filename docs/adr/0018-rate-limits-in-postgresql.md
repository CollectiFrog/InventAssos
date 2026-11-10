---
title: "0018: Rate limits on e-mail sending, counted in PostgreSQL"
description: Fixed-window counters in a rate_limits table, per target address, client and user.
---

| Status   | Date       | Deciders                  |
|----------|------------|---------------------------|
| Proposed | 2026-11-09 | @claude (security review) |

## Context

Several endpoints send e-mail through the Collecti'FROG SMTP on a request: the sign-in link and
the sign-up form (anyone, any address), re-application after a rejection, requests for a new
collectif or to become responsible (they notify the admins) and the item contact form. None was
limited (security review F2, issue #70). A script could flood a mailbox, flood the admins, and get
`noreply@collecti-frog.fr` blacklisted, which would break sign-in for everyone (ADR 0008).

The sign-in and sign-up responses must also not reveal whether an address has an account
(US-0.2.2), yet the SMTP send was awaited only when it had one (review F3).

Constraints: no new service (issue #70, option B); the app runs as one or more pods behind the
cluster ingress, where the socket address is the ingress, not the visitor.

## Decision

Count hits in a PostgreSQL table, `rate_limits(key_hash, hits, reset_at)`, with one atomic upsert
per hit (fixed window). The key is hashed with SHA-256, so no address or ID is stored; rows are
purged hourly with the expired sessions (`app/maintenance.ts`). Limits live in `app/rate-limits.ts`:

| Limit                                                     | Key            | Default   | When reached                       |
|-----------------------------------------------------------|----------------|-----------|------------------------------------|
| sign-in links and sign-up answers to one address          | target e-mail  | 5 / hour  | no e-mail, same answer as usual    |
| sign-in and sign-up forms from one client                 | client address | 20 / 15 m | `429 Trop de demandes`             |
| new-collectif, responsibility and re-application requests | user           | 5 / day   | `429`, nothing recorded            |
| contact messages                                          | user           | 10 / day  | `429`, nothing sent                |
| "new request" e-mails to the admins, per kind of request  | kind           | 5 / hour  | no e-mail; the request is recorded |

- The per-address limit counts every address, with or without an account, so it reveals nothing.
- Visitors are keyed by client address, not by session: a script drops its cookies.
- **Client address.** `server.ts` passes the socket address to the router in an internal header
  that replaces any copy sent by the client. With `TRUST_PROXY=true`, `remix/node-fetch-server`
  takes it from `Forwarded` / `X-Forwarded-For` instead (its first value). Set it only when the
  ingress overwrites that header (ingress-nginx and Traefik do by default); otherwise a client
  could pick its own address. In production without it, the app logs a warning, and the
  per-client limit then applies to all visitors together.
- **Timing (US-0.2.2).** After the per-client check, sign-in and sign-up answer at once and do
  the rest (account lookup, token, e-mails) in a background task (`app/background.ts`), so the
  response time no longer depends on the address. Shutdown waits for pending tasks.

## Alternatives

| Option                        | Pros                     | Cons                                          | Why not                                |
|-------------------------------|--------------------------|-----------------------------------------------|----------------------------------------|
| Nothing until V1.0 (#70 A)    | no code                  | relies on admin vigilance; SMTP reputation    | the sign-in path is public             |
| Ingress limit by IP (#70 C)   | outside the app          | cannot protect one target address; infra repo | does not stop flooding one mailbox     |
| In-memory counters            | no table                 | lost on restart, not shared between pods      | the app may run several pods           |
| Redis                         | fast, built-in TTL       | one more service to run and back up           | PostgreSQL is already there (ADR 0007) |
| Sliding window / token bucket | smoother at window edges | more SQL for little gain at this scale        | fixed windows are enough here          |

## Consequences

- One small upsert per limited request; one more table to purge, done hourly.
- An attacker can use up an address's 5 e-mails an hour, so its owner may not receive a link for
  up to an hour. Sessions last 30 days, so this rarely matters; the per-client limit bounds it.
- Admin notifications can be skipped in a burst; the admin queue still lists every request, and
  the e-mail now says "at least one new request".
- Background tasks run after the response: their errors are logged, not shown to the visitor.
- The limits are constants: changing them is a code change and a release.
