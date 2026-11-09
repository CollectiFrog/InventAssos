---
title: Releasing
description: Ship a version, publish the image, deploy.
sidebar:
  order: 4
---

The step-by-step procedure is in `.ia/skills/git-workflow/SKILL.md` → *Release procedure*.

## What the automation does

| Event                   | Workflow       | Result                                                                             |
|-------------------------|----------------|------------------------------------------------------------------------------------|
| PR opened or updated    | `ci.yml`       | lint, typecheck, tests (PostgreSQL service), build, Docker image build, docs build |
| PR title edited         | `pr-title.yml` | checks the Conventional Commit title                                               |
| push to `main` or `dev` | `docs.yml`     | user docs from `main` at `/`, dev docs from `dev` at `/dev/`                       |
| tag `vX.Y.Z` on `main`  | `release.yml`  | image `ghcr.io/<owner>/<repo>:X.Y.Z` + GitHub Release                              |

The `check` job runs the Makefile targets after `npm ci`, with a PostgreSQL 17 service container
reached through `TEST_DATABASE_URL`. Its checks (`Lint, typecheck, test, build`,
`Docker image build`, `Docs build`, `conventional-commit`) are meant to be **required** in the repository rulesets, so a
red check blocks the merge.

## The image

`Dockerfile` builds `ghcr.io/collectifrog/inventassos:X.Y.Z` in two stages: production
dependencies only (`npm ci --omit=dev`), then a `node:24-alpine` runtime that runs as the
unprivileged `node` user. Remix 3 runs the TypeScript source directly (`remix/node-tsx`), so the
image contains `server.ts`, `app/`, `db/migrations/`, `public/` and `tsconfig.json` (read by the
loader for JSX), nothing else. `.dockerignore` is an allow-list: tests, `.env`, docs and media
never enter the build context.

```sh
docker build -t inventassos:local .
docker run --rm -p 3000:3000 -e DATABASE_URL=postgres://… inventassos:local
```

The container listens on `PORT` (default 3000), applies migrations at startup and stops cleanly on
`SIGTERM`.

## Deploying

The Kubernetes manifests live in the infra repository and the cluster pulls the image from GHCR.
For now the image tag is bumped **by hand** in the infra repository after each release
(see [ADR 0005](../../adr/0005-deployment/)). Argo CD Image Updater is the planned replacement.
The proof of concept runs at `https://inv.collecti-frog.fr`; TLS is terminated by the cluster
ingress, the container itself speaks plain HTTP on `PORT`.

### What the manifests must provide

| Variable                | From | Secret | Value                                                                            |
|-------------------------|------|--------|----------------------------------------------------------------------------------|
| `DATABASE_URL`          | V0.1 | yes    | `postgres://user:password@host:5432/inventassos`                                 |
| `PORT`                  | V0.1 | no     | container port, default `3000`                                                   |
| `APP_URL`               | V0.2 | no     | public origin used in e-mail links: `https://inv.collecti-frog.fr`               |
| `SESSION_SECRET`        | V0.2 | yes    | ≥ 32 random characters (`openssl rand -base64 48`); the example value is refused |
| `PLATFORM_ADMIN_EMAILS` | V0.2 | no     | comma-separated e-mails that become admin at first sign-in; read at startup      |
| `SMTP_URL`              | V0.2 | yes    | Zimbra SMTP, e.g. `smtps://noreply%40collecti-frog.fr:password@mail.example:465` |
| `MAIL_FROM`             | V0.2 | no     | `InventAssos <noreply@collecti-frog.fr>`                                         |

`.env.example` is the reference list; a missing required variable stops the container at startup
with a message naming it. Secrets go in a Kubernetes `Secret`, never in the infra repository in
clear.

The app sets its own browser security headers on every response: `Content-Security-Policy` (no
script, `frame-ancestors 'none'`), `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
`Referrer-Policy: same-origin`, and `Strict-Transport-Security` when `APP_URL` is https. The
ingress does not need to add them; if it does, check that its values are not weaker.

### Probes

| Path       | Use as          | Answers                                                                  |
|------------|-----------------|--------------------------------------------------------------------------|
| `/healthz` | liveness probe  | `200 {"status":"ok"}` while the process runs; never queries the database |
| `/readyz`  | readiness probe | `200` when PostgreSQL answers, `503 {"status":"unavailable"}` otherwise  |

The liveness probe ignores the database on purpose: a database outage must not make Kubernetes
restart every pod in a loop. Example:

```yaml
readinessProbe: { httpGet: { path: /readyz, port: 3000 }, periodSeconds: 10 }
livenessProbe:  { httpGet: { path: /healthz, port: 3000 }, periodSeconds: 20, failureThreshold: 3 }
```

### Migrations

Pending migrations run at startup, before the server listens (ADR 0013), under a PostgreSQL
advisory lock, so several replicas can start together. If a migration fails, the container exits
and never becomes ready: the previous pods keep serving. Read the pod logs, fix forward with a
`fix/…` release.

### Deploy a version

1. Release `vX.Y.Z` (see the git-workflow skill); wait for the `release` workflow to push the image.
2. In the infra repository, set the image to `ghcr.io/collectifrog/inventassos:X.Y.Z` and apply.
3. Check: `curl -fsS https://inv.collecti-frog.fr/readyz` answers `200`, then open the home page.

### Roll back

1. In the infra repository, set the image back to the previous tag `X.Y.(Z-1)` and apply.
2. Check `/readyz` and the home page as above.

The schema is **not** rolled back with the image. Migrations are written to stay compatible with
the previous release (add columns or tables, drop them only in a later release), so the previous
image runs on the newer schema. Only if a release must be undone together with its schema, and the
migration has a `down.sql`, revert it from a checkout of the released tag, with `DATABASE_URL`
pointing at production (for example through `kubectl port-forward`):

```sh
node --env-file=.env node_modules/.bin/remix db rollback --step 1 --dry-run   # read the plan
node --env-file=.env node_modules/.bin/remix db rollback --step 1
```

Take a `pg_dump` before any schema rollback.
