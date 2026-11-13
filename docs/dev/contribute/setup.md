---
title: Setup
description: Get a working development environment.
sidebar:
  order: 1
---

## Requirements

Pick one of three ways; all run the same Makefile targets against the same Compose services.

| Way                                   | You install                      | Best for                        |
|---------------------------------------|----------------------------------|---------------------------------|
| [Dev Container](#dev-container)       | Docker, VS Code + Dev Containers | VS Code users, Codespaces       |
| [Docker only](#docker-only)           | Docker with Compose              | any editor, no Node on the host |
| [Node on the host](#node-on-the-host) | Node.js ≥ 24.3, Docker, `make`   | fastest reload, native tools    |

In every case: Git, with symlinks enabled on Windows: `git config --global core.symlinks true`
(and Developer Mode on), so `.claude/skills` resolves.

## Get the code

```sh
git clone <repo-url> && cd <repo>
git switch dev
```

## Dev Container

Open the folder in VS Code and choose **Reopen in Container** (Dev Containers extension), or open
the repository in a Codespace. `.devcontainer/` reuses the `app` service of `compose.yaml`, so
PostgreSQL and Mailpit start next to it and `npm ci` runs once in the container.

In the VS Code terminal, which runs inside the container:

```sh
make dev     # the app on http://localhost:3000, restarted when a file changes
make check   # lint, typecheck, test, build: the same as CI
make a11y    # accessibility of the key pages in Chromium (ADR 0024), also in CI
```

E-mails land in Mailpit on http://localhost:8025. Ports are forwarded by VS Code.

The container also has Claude Code (`claude`) and the GitHub CLI (`gh`). Sign in once with
`claude` and `gh auth login`; `.devcontainer/compose.yaml` keeps both sign-ins in volumes across
rebuilds. Git pushes use VS Code's forwarded credentials. `.devcontainer/devcontainer-lock.json` pins the
feature versions: commit it when a rebuild updates it.

## Docker only

```sh
docker compose up app                     # db, mail, then the app on http://localhost:3000
docker compose run --rm app make check    # or make test, in a throwaway container
docker compose exec app make test         # same, in the running app container
```

The `app` service mounts the source and restarts the server when a file changes. It runs
`make deps` at start, which runs `npm ci` only when `package-lock.json` changed. Dependencies live in
the `node-modules` volume, apart from the host's `node_modules`, so the two ways never mix Linux and
host binaries. Compose sets `DATABASE_URL`, `TEST_DATABASE_URL`, `SMTP_URL` (Mailpit) and a
development `SESSION_SECRET`; they win over `.env`, which is optional here. Sign in as
`admin@example.org` to be platform admin.

In the container, `make dev` restarts the server by polling modification times every second
(`scripts/dev-poll.ts`, `DEV_POLL` in `compose.yaml`): file change events from a Windows or macOS
host folder do not reach a container. On the host, `make dev` keeps Node's own `--watch`.

## Node on the host

```sh
nvm use               # Node version from .nvmrc
npm ci
cp .env.example .env  # defaults match compose.yaml
make dev              # starts PostgreSQL in Docker, then the app on http://localhost:3000
```

`make dev` restarts the server when a file changes. Without `SMTP_URL`, e-mails (sign-in links)
are printed in the terminal; with `SMTP_URL=smtp://localhost:1025` they land in Mailpit. Do not run
it while the `app` service is up: both listen on port 3000.

## Useful commands

Migrations in `db/migrations/` are applied at startup.

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
make a11y    # accessibility of the key pages in Chromium (ADR 0024), also in CI
```

`make a11y` downloads Chromium on its first run. Outside the dev container, Chromium also needs
system libraries: `npx playwright install --with-deps chromium` (root on Linux).

Tests use the `inventassos_test` database that PostgreSQL creates at its first start
(`db/init/`). Point `TEST_DATABASE_URL` elsewhere
if your PostgreSQL is not the Compose one.

## Preview the documentation

```sh
cd docs/site && npm ci
npm run dev:user   # http://localhost:4321
npm run dev:dev    # http://localhost:4322
```
