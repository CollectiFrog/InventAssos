---
title: Overview
description: How the system is built. Source of truth for the architecture.
sidebar:
  order: 1
---

InventAssos is one Remix 3 application backed by PostgreSQL, deployed as a single container on a
self-hosted Kubernetes cluster. Every permission check runs on the server.

## Context

```mermaid
flowchart LR
  user([Volunteer]) -- HTTPS --> app[InventAssos<br/>Remix 3 · Node ≥ 24.3]
  admin([Platform admin]) -- HTTPS --> app
  app --> db[(PostgreSQL)]
  app -- SMTP --> mail[Zimbra<br/>noreply@collecti-frog.fr]
  app -. V0.9 .-> s3[(MinIO · photos)]
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
| Auth            | sign-up, e-mail sign-in links, sessions, CSRF, current user                       | `app/actions/sign-{up,in}/`, `app/middleware/`                 |
| Permissions     | one function per action, deny by default                                          | `app/permissions.ts`, guards in `app/actions/guards.tsx`       |
| Data access     | one module per entity, the only place with SQL                                    | `app/data/`                                                    |
| Audit log       | append-only, IDs only (ADR 0010)                                                  | `app/data/audit-log.ts`                                        |
| Migrations      | versioned SQL, applied at startup (ADR 0013)                                      | `db/migrations/NNNN_slug/{up,down}.sql`                        |
| Mailer          | sign-in links and admin notifications (ADR 0016)                                  | `app/mail/`                                                    |
| Import / export | CSV and Excel parsing and generation, server side                                 | `app/` (V0.10)                                                 |
| Static files    | stylesheet, favicon                                                               | `public/`                                                      |
| Health probes   | `/healthz` (process), `/readyz` (database)                                        | `app/actions/health/`                                          |
| Tests           | router tests against PostgreSQL (ADR 0012)                                        | `**/*.test.ts` next to the code, `test/`                       |

A request goes `server.ts` → `router.fetch` → middleware (`app/middleware/index.ts`) → the
controller action matched in `app/routes.ts` → a `Response`. `createAppRouter(deps)` receives its
services (database, mailer, settings, session secret), so tests build the same router with test
doubles (`test/app.ts`).

Middleware order: security headers and CSP → static files → database, mailer, settings on the context → session
(PostgreSQL, ADR 0017) → current user (`context.currentUser`) → form data → CSRF check on unsafe
methods → renderer.

The sign-in link opens a page with a button that POSTs the token: e-mail scanners that prefetch
links cannot burn it. The token is consumed by a single `UPDATE … WHERE used_at IS NULL AND
expires_at > now()`, so two clicks cannot both succeed.

## Data

See [Data model](../data-model/) for entities and constraints, and
[Permissions](../permissions/) for who can do what.

## Configuration

Everything comes from environment variables, documented in `.env.example`: database URL, SMTP,
session secret, `PLATFORM_ADMIN_EMAILS`, S3 (from V0.9). No deployment value lives in the code.

## Decisions

| Topic                   | ADR                                                          |
|-------------------------|--------------------------------------------------------------|
| Framework               | [0006](../../adr/0006-remix-3-full-stack/)                   |
| Database                | [0007](../../adr/0007-postgresql/)                           |
| Accounts and sign-in    | [0008](../../adr/0008-app-managed-accounts/)                 |
| Ownership and locations | [0009](../../adr/0009-ownership-and-locations/)              |
| Personal data retention | [0010](../../adr/0010-personal-data-retention/)              |
| Roles                   | [0020](../../adr/0020-platform-and-collectif-roles/)         |
| Inventory visibility    | [0021](../../adr/0021-inventory-within-collectifs/)          |
| Deployment              | [0005](../../adr/0005-deployment/)                           |
| Tests                   | [0012](../../adr/0012-testing-with-remix-test/)              |
| Migrations              | [0013](../../adr/0013-sql-migrations-at-startup/)            |
| Lint and format         | [0014](../../adr/0014-lint-and-format-with-biome/)           |
| Server-rendered HTML    | [0015](../../adr/0015-server-rendered-html/)                 |
| E-mail                  | [0016](../../adr/0016-mail-through-nodemailer/)              |
| Sessions                | [0017](../../adr/0017-sessions-in-postgresql/)               |
| Rate limits             | [0018](../../adr/0018-rate-limits-in-postgresql/)            |
| Interface               | [0019](../../adr/0019-interface-conventions/) · [UI](../ui/) |
