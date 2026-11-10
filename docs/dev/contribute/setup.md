---
title: Setup
description: Get a working development environment.
sidebar:
  order: 1
---

## Requirements

- Node.js ≥ 24.3 (required by Remix 3).
- Docker with Compose, to run PostgreSQL locally (`compose.yaml`).
- Git, with symlinks enabled on Windows: `git config --global core.symlinks true`
  (and Developer Mode on), so `.claude/skills` resolves.

## Get the code

```sh
git clone <repo-url> && cd <repo>
git switch dev
```

## Run the app

```sh
nvm use               # Node version from .nvmrc
npm ci
cp .env.example .env  # defaults match compose.yaml
make dev              # starts PostgreSQL in Docker, then the app on http://localhost:3000
```

`make dev` restarts the server when a file changes. Without `SMTP_URL`, e-mails (sign-in links)
are printed in the terminal; with `SMTP_URL=smtp://localhost:1025` they land in Mailpit. Migrations in `db/migrations/` are applied at
startup. Useful commands:

| Command                                                  | Does                                             |
|----------------------------------------------------------|--------------------------------------------------|
| `make db`                                                | start only PostgreSQL (also creates the test DB) |
| `node --env-file=.env node_modules/.bin/remix db status` | list applied and pending migrations              |
| `npx biome check --write .`                              | fix lint and format findings                     |

A new migration is a new directory `db/migrations/NNNN_slug/` with `up.sql` (and `down.sql` if
reversible). Never edit an applied one (ADR 0013).

## Run the checks

```sh
make check   # lint, typecheck, test, build: the same as CI
```

Tests use the `inventassos_test` database created by `make db`. Point `TEST_DATABASE_URL` elsewhere
if your PostgreSQL is not the Compose one.

## Preview the documentation

```sh
cd docs/site && npm ci
npm run dev:user   # http://localhost:4321
npm run dev:dev    # http://localhost:4322
```
