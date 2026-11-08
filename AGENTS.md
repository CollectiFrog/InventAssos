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

| Command          | Does                           |
|------------------|--------------------------------|
| `make lint`      | lint                           |
| `make typecheck` | static type checks             |
| `make test`      | unit tests                     |
| `make build`     | production build               |
| `make check`     | all four, in that order        |
| `make docs`      | build both documentation sites |

<!-- TEMPLATE: replace the Makefile placeholders with the project's real commands, then delete this line. -->

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
| `.github/workflows/` | CI (PR checks), PR title, docs, release                     |
| `CHANGELOG.md`       | user-visible changes, Keep a Changelog format               |

Project-specific rules go below this line, kept short.

## Project-specific rules

<!-- e.g. framework conventions, data rules, modules that must not depend on each other. -->
