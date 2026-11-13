---
title: Overview
description: How the system is built. Source of truth for the architecture.
sidebar:
  order: 1
---

AssoMatos (repository `InventAssos`) is one Remix 3 application backed by PostgreSQL, deployed as a single container on a
self-hosted Kubernetes cluster. Every permission check runs on the server.

## Context

```mermaid
flowchart LR
  user([Volunteer]) -- HTTPS --> app[AssoMatos<br/>Remix 3 · Node ≥ 24.3]
  admin([Platform admin]) -- HTTPS --> app
  app --> db[(PostgreSQL)]
  app -- SMTP --> mail[Zimbra<br/>noreply@collecti-frog.fr]
  app -. V0.11 .-> s3[(object store · photos)]
  gh[GitHub Actions] -- image vX.Y.Z --> ghcr[(GHCR)]
  ghcr -- pulled by --> app
```

## Components

| Component       | Responsibility                                                                    | Code / where                                                   |
|-----------------|-----------------------------------------------------------------------------------|----------------------------------------------------------------|
| Entry point     | read config, migrate, listen, shut down cleanly                                   | `server.ts`, `app/config.ts`                                   |
| Routes          | the URL contract, used for every link and redirect                                | `app/routes.ts`                                                |
| Router          | middleware chain and controller mapping                                           | `app/router.ts`, `app/middleware/`                             |
| Controllers     | pages, forms, server actions; one folder per route map                            | `app/actions/<key>/controller.tsx`, nested maps in sub-folders |
| Views           | server-rendered Remix components (ADR 0015), one responsive layout ([UI](../ui/)) | `app/actions/**/*-page.tsx`, `app/ui/`                         |
| Auth            | sign-up, e-mail links, passwords (ADR 0029), sessions, CSRF, current user         | `app/actions/{sign-up,sign-in,password}/`, `app/passwords.ts`  |
| Permissions     | one function per action, deny by default                                          | `app/permissions.ts`, guards in `app/actions/guards.tsx`       |
| Data access     | one module per entity, the only place with SQL                                    | `app/data/`                                                    |
| Audit log       | append-only, IDs only (ADR 0010)                                                  | `app/data/audit-log.ts`                                        |
| Migrations      | versioned SQL, applied at startup (ADR 0013)                                      | `db/migrations/NNNN_slug/{up,down}.sql`                        |
| Mailer          | sign-in links and admin notifications (ADR 0016)                                  | `app/mail/`                                                    |
| Import / export | CSV and Excel parsing and generation, server side                                 | `app/` (V0.10)                                                 |
| Static files    | stylesheet, favicon                                                               | `public/`                                                      |
| Health probes   | `/healthz` (process), `/readyz` (database)                                        | `app/actions/health/`                                          |
| Tests           | router tests against PostgreSQL (ADR 0012)                                        | `**/*.test.ts` next to the code, `test/`                       |
| Accessibility   | axe-core audit of the key pages in Chromium (ADR 0024)                            | `app/accessibility.test.e2e.ts`, `test/browser.ts`             |

A request goes `server.ts` → `router.fetch` → middleware (`app/middleware/index.ts`) → the
controller action matched in `app/routes.ts` → a `Response`. `createAppRouter(deps)` receives its
services (database, mailer, settings, session secret), so tests build the same router with test
doubles (`test/app.ts`).

Middleware order: security headers and CSP → static files → database, mailer, settings on the context → session
(PostgreSQL, ADR 0017) → current user (`context.currentUser`) → inactive-account gate → form data
→ CSRF check on unsafe methods → renderer.

Form data is parsed by `boundedFormData` (`app/middleware/forms.ts`), before the CSRF check: no
file, 400 fields, 256 KiB of form content per request and, in a multipart form, 64 KiB per field
and 1 KiB per part header. A larger body is refused with 413, before it is read when
`Content-Length` says so; anything the parser cannot read (bad framing, invalid UTF-8) with 400.
Both answers are a bare line of text: browsers never send such forms from our pages. A route that takes a
file names its own limits through `uploadFor`, and only an active user can reach it, since the
gate runs first.

Opening the sign-in link (GET) signs in at once and redirects; a HEAD request leaves the token
alone. A mail scanner that opens links before the person does uses the token up: the field asked
for one click less, and the person can request a new link. The token is consumed by a single
`UPDATE … WHERE used_at IS NULL AND expires_at > now()`, so two clicks cannot both succeed.

## Data

See [Data model](../data-model/) for entities and constraints, and
[Permissions](../permissions/) for who can do what.

## Configuration

Everything comes from environment variables, documented in `.env.example`: database URL, SMTP,
session secret, `PLATFORM_ADMIN_EMAILS`, the photo store (from V0.11). No deployment value lives in the code.

## Decisions

| Topic                   | ADR                                                                                                                   |
|-------------------------|-----------------------------------------------------------------------------------------------------------------------|
| Framework               | [0006](../../adr/0006-remix-3-full-stack/)                                                                            |
| Database                | [0007](../../adr/0007-postgresql/)                                                                                    |
| Accounts and sign-in    | [0008](../../adr/0008-app-managed-accounts/), [0029](../../adr/0029-password-sign-in/)                                |
| Ownership and locations | [0009](../../adr/0009-ownership-and-locations/)                                                                       |
| Personal data retention | [0010](../../adr/0010-personal-data-retention/)                                                                       |
| Roles                   | [0020](../../adr/0020-platform-and-collectif-roles/), [0028](../../adr/0028-admins-named-in-the-app/)                 |
| Inventory visibility    | [0021](../../adr/0021-inventory-within-collectifs/), [0023](../../adr/0023-collectif-city/)                           |
| Deployment              | [0005](../../adr/0005-deployment/)                                                                                    |
| Tests                   | [0012](../../adr/0012-testing-with-remix-test/)                                                                       |
| Accessibility check     | [0024](../../adr/0024-accessibility-check-with-axe/)                                                                  |
| Migrations              | [0013](../../adr/0013-sql-migrations-at-startup/)                                                                     |
| Lint and format         | [0014](../../adr/0014-lint-and-format-with-biome/)                                                                    |
| Server-rendered HTML    | [0015](../../adr/0015-server-rendered-html/)                                                                          |
| E-mail                  | [0016](../../adr/0016-mail-through-nodemailer/)                                                                       |
| Sessions                | [0017](../../adr/0017-sessions-in-postgresql/)                                                                        |
| Rate limits             | [0018](../../adr/0018-rate-limits-in-postgresql/)                                                                     |
| Interface               | [0019](../../adr/0019-interface-conventions/), [0022](../../adr/0022-sidebar-navigation-on-computers/) · [UI](../ui/) |
