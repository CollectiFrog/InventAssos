# AGENTS.md

Single source of rules for every coding agent (Claude Code, Codex, Cursor, Copilot…)
and for humans. `CLAUDE.md` only imports this file: **never copy rules into it**.

## Read first

1. [`.ia/context/project.md`](.ia/context/project.md): what the project is, for whom, stack, glossary.
2. The skill matching your task, in [`.ia/skills/`](.ia/skills/):

| Skill                                                          | Use it when                                    |
|----------------------------------------------------------------|------------------------------------------------|
| [`coding-conventions`](.ia/skills/coding-conventions/SKILL.md) | writing or reviewing any code, test, doc       |
| [`git-workflow`](.ia/skills/git-workflow/SKILL.md)             | branching, committing, opening a PR, releasing |
| [`remix`](.ia/skills/remix/SKILL.md)                           | writing or changing any app code               |

Claude Code loads these skills automatically through the symlink `.claude/skills → ../.ia/skills`.
Other agents: open the `SKILL.md` yourself before the task it covers.

3. Architecture and decisions: [`docs/dev/architecture/`](docs/dev/architecture/) and [`docs/adr/`](docs/adr/).
   The docs are the source of truth; if code and docs disagree, say so instead of guessing.

## Rules that always apply

- **Language.** Code, comments, commits, PRs and technical docs (`docs/dev`, `docs/adr`) in English.
  User interface and user docs (`docs/user`) in the project language (see `.ia/context/project.md`).
- **Never push to `main` or `dev`.** Work on `feat/…` or `fix/…` from `dev`, open a PR to `dev`.
- **One change ships with its tests, its docs and its `CHANGELOG.md` line**, in the same PR.
- **Structural decision → ADR.** A new dependency family, a data model choice, an architecture shift:
  write `docs/adr/NNNN-title.md` from [`0000-template.md`](docs/adr/0000-template.md). Never rewrite an
  accepted ADR; supersede it with a new one.
- **Rules stay true.** A rule here or in a skill that describes code or a process that no longer exists
  is deleted or fixed in the same PR that made it false. Rules are short and checked in review.
- **Propose rule updates.** When a new convention or process emerges, propose the edit to this file or
  to the relevant skill in the same turn, rather than letting it drift.
- **Ask, don't guess**, on anything irreversible or outward-facing: releases, tags, deployments,
  deleting data, force-pushing, changing CI secrets. Tagging a release is the maintainer's call.

## Commands

The CI calls the same targets as you. Run them before opening a PR.

| Command          | Does                             |
|------------------|----------------------------------|
| `make lint`      | lint                             |
| `make typecheck` | static type checks               |
| `make test`      | tests, against PostgreSQL        |
| `make build`     | load the production module graph |
| `make check`     | all four, in that order          |
| `make docs`      | build both documentation sites   |
| `make db`        | start PostgreSQL (Docker)        |
| `make dev`       | `make db`, then the app on :3000 |

Without Node or `make` on the host, run any target in the app container:
`docker compose run --rm app make check` (see `docs/dev/contribute/setup.md`).

## Repository map

| Path                 | Contains                                                    |
|----------------------|-------------------------------------------------------------|
| `AGENTS.md`          | these rules (single source)                                 |
| `CLAUDE.md`          | `@AGENTS.md` import only                                    |
| `.ia/context/`       | project context for agents                                  |
| `.ia/skills/`        | task procedures (`<name>/SKILL.md`)                         |
| `.ia/sources/`       | external references: specs, API docs, notes worth keeping   |
| `docs/user/`         | user docs → published from `main` at `/`                    |
| `docs/dev/`          | developer docs → published from `dev` at `/dev/`            |
| `docs/adr/`          | architecture decision records → published with the dev docs |
| `docs/site/`         | the Starlight app that renders both sites                   |
| `design/maquette/`   | V0.7 clickable mock-up sources (claude.ai Design canvas)    |
| `.github/workflows/` | CI (PR checks), PR title, docs, release                     |
| `CHANGELOG.md`       | user-visible changes, Keep a Changelog format               |
| `server.ts`          | entry point: config, migrations, HTTP server                |
| `app/`               | the Remix 3 application (routes, actions, data, ui)         |
| `db/migrations/`     | SQL migrations, applied at startup                          |
| `public/`            | static files served as is                                   |
| `test/`              | shared test helpers (test database, requests)               |
| `Dockerfile`         | production image, published on GHCR by `release.yml`        |
| `compose.yaml`       | dev services: `db`, `mail`, `app` (Docker-only development) |
| `.devcontainer/`     | VS Code Dev Container on the `app` service                  |

Project-specific rules go below this line, kept short.

## Project-specific rules

- **Remix 3 is not React.** Remix 3 (stable since 2026-10-01) has its own component model and
  packages; most models were trained before it. Read the official docs
  (<https://remix.run>, <https://api.remix.run>, or offline `node_modules/remix/INDEX.md`) before
  writing code; the [`remix`](.ia/skills/remix/SKILL.md) skill says how. Never write React, Remix v2
  or React Router code. See `docs/adr/0006-remix-3-full-stack.md`.
- **Deny by default.** Every action is checked on the server against
  `docs/dev/architecture/permissions.md`; the UI is never the only barrier. Each rule has a unit test
  and a row in `app/permissions.matrix.test.ts`.
- **Data access goes through one module per entity.** No SQL in routes or components.
- **Audit log stores IDs only**: never a name, e-mail or phone (`docs/adr/0010-personal-data-retention.md`).
- **Exact addresses never leave the owner.** Other users, exports and APIs get the city only:
  pass every location through `redactLocation(location, canSeeFullAddress(actor, location))`.
- **Ownership ≠ storage.** An item has one owner (collectif xor person) and one location; never merge
  the two (`docs/adr/0009-ownership-and-locations.md`).
- **One responsive interface.** Pages follow `docs/dev/architecture/ui.md` and reuse the shared pieces
  in `app/ui/`; no separate mobile UI (`docs/adr/0019-interface-conventions.md`).
- **Specs live in `docs/dev/product/`.** Work on a user story only once it is listed there; if a
  story is ambiguous, ask instead of guessing.
