---
title: Releasing
description: Ship a version, publish the image, deploy.
sidebar:
  order: 4
---

The step-by-step procedure is in `.ia/skills/git-workflow/SKILL.md` → *Release procedure*.

## What the automation does

| Event                   | Workflow       | Result                                                         |
|-------------------------|----------------|----------------------------------------------------------------|
| PR opened or updated    | `ci.yml`       | lint, typecheck, tests (PostgreSQL service), build, docs build |
| PR title edited         | `pr-title.yml` | checks the Conventional Commit title                           |
| push to `main` or `dev` | `docs.yml`     | user docs from `main` at `/`, dev docs from `dev` at `/dev/`   |
| tag `vX.Y.Z` on `main`  | `release.yml`  | image `ghcr.io/<owner>/<repo>:X.Y.Z` + GitHub Release          |

The `check` job runs the Makefile targets after `npm ci`, with a PostgreSQL 17 service container
reached through `TEST_DATABASE_URL`. Its three checks (`Lint, typecheck, test, build`,
`Docs build`, `conventional-commit`) are meant to be **required** in the repository rulesets, so a
red check blocks the merge.

## Deploying

The Kubernetes manifests live in the infra repository and the cluster pulls the image from GHCR.
For now the image tag is bumped **by hand** in the infra repository after each release
(see [ADR 0005](../../adr/0005-deployment/)). Argo CD Image Updater is the planned replacement.
