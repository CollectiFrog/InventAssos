---
title: "0017: Server-side sessions in PostgreSQL"
description: The cookie holds a signed random ID; session data lives in a sessions table.
---

| Status   | Date       | Deciders              |
|----------|------------|-----------------------|
| Proposed | 2026-11-08 | @claude (nightly run) |

## Context

Disabling an account must close its sessions at once (US-0.2.7) and signing out must invalidate
the session server side. Remix 3 ships cookie, file, memory, Redis and Memcache session storages.

## Decision

- `remix/middleware/session` with a signed, `HttpOnly`, `SameSite=Lax` cookie that holds only a
  random session ID (`Secure` when `APP_URL` is https).
- A custom `SessionStorage` (`app/data/sessions.ts`) keeps the data in a `sessions` table, with
  the user's ID in its own column, so `deleteUserSessions()` closes them all.
- Only signed-in sessions get a row. A visitor's session (CSRF token, flash messages) is kept in
  the signed cookie itself, so anonymous traffic never grows the table; a cookie that claims a
  user ID is ignored, since identity must stay revocable.
- Sessions last 30 days (open point US-0.2.2); expired rows are purged at startup and then every
  hour (`app/maintenance.ts`), with used or expired sign-in tokens.
- CSRF tokens (`remix/middleware/csrf`) live in the session and are checked on every unsafe
  request; GET requests do not create a session unless the page shows a form. Signing in clears
  the session data, so the CSRF token changes along with the session ID.

## Alternatives

| Option             | Pros           | Cons                                    | Why not                     |
|--------------------|----------------|-----------------------------------------|-----------------------------|
| Cookie storage     | no table       | cannot be revoked before it expires     | US-0.2.7 needs revocation   |
| Filesystem storage | built in       | lost on pod restart, not shared by pods | the app runs in Kubernetes  |
| Redis storage      | built in, fast | one more service to run                 | PostgreSQL is already there |

## Consequences

- One small query per request that carries a signed-in session cookie; none for visitors.
- Session data is personal data: it is deleted with the account (`on delete cascade`).
