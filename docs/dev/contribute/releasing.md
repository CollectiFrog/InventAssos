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

How to run a version on the cluster (manifests, variables, secrets, probes, migrations, first
admin, rollback) is in [Deploy on Kubernetes](../deploying/).
