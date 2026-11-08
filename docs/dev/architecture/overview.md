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
  app -. V0.7 .-> s3[(MinIO · photos)]
  gh[GitHub Actions] -- image vX.Y.Z --> ghcr[(GHCR)]
  ghcr -- pulled by --> app
```

## Components

| Component        | Responsibility                                     | Code / where            |
|------------------|----------------------------------------------------|-------------------------|
| Routes and views | pages, forms, server actions                       | `app/` (V0.1)           |
| Auth             | sign-up, e-mail sign-in links, sessions, CSRF      | `app/` (V0.2)           |
| Permissions      | one function per action, deny by default           | `app/` (V0.2)           |
| Data access      | one module per entity, the only place with SQL     | `app/` (V0.1)           |
| Migrations       | versioned schema changes, run at startup           | `db/migrations/` (V0.1) |
| Mailer           | sign-in links and admin notifications through SMTP | `app/` (V0.2)           |
| Import / export  | CSV and Excel parsing and generation, server side  | `app/` (V0.8)           |

Paths are indicative until V0.1 sets them; update this table in the same PR.

## Data

See [Data model](../data-model/) for entities and constraints, and
[Permissions](../permissions/) for who can do what.

## Configuration

Everything comes from environment variables, documented in `.env.example`: database URL, SMTP,
session secret, `PLATFORM_ADMIN_EMAILS`, S3 (from V0.7). No deployment value lives in the code.

## Decisions

| Topic                   | ADR                                               |
|-------------------------|---------------------------------------------------|
| Framework               | [0006](../../adr/0006-remix-3-full-stack/)        |
| Database                | [0007](../../adr/0007-postgresql/)                |
| Accounts and sign-in    | [0008](../../adr/0008-app-managed-accounts/)      |
| Ownership and locations | [0009](../../adr/0009-ownership-and-locations/)   |
| Personal data retention | [0010](../../adr/0010-personal-data-retention/)   |
| Admin validation        | [0011](../../adr/0011-platform-admin-validation/) |
| Deployment              | [0005](../../adr/0005-deployment/)                |
