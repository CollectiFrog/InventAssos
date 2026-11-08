---
name: coding-conventions
description: Conventions for writing and reviewing code, tests and docs in this repository (comments, tests, docs and CHANGELOG updates, secrets, dead code, dependencies). Use before writing or reviewing any change.
---

# Coding conventions

Language-agnostic rules. Project or language rules go in `AGENTS.md` → *Project-specific rules*.

## Definition of done

A change is done when the PR contains, together:

| Item           | Rule                                                                             |
|----------------|----------------------------------------------------------------------------------|
| Code           | passes `make check` (lint, typecheck, test, build)                               |
| Unit tests     | every new or changed behaviour has a test; a fixed bug gets a failing test first |
| Docs           | `docs/user` if a user sees it, `docs/dev` if a developer needs it                |
| ADR            | a structural decision gets `docs/adr/NNNN-title.md`                              |
| `CHANGELOG.md` | one line under `## [Unreleased]` for anything a user can notice                  |
| Rules          | `AGENTS.md` and skills still true after the change                               |

## Comments: why, not what

A reader must get a comment in **3 to 5 seconds**.

- Explain **why**: intent, constraint, trap, non-obvious choice. Never repeat **what** the code says.
- **At most 2 lines, about 25 words.** Longer explanations go to `docs/dev` or an ADR; the comment
  links to it (`// See docs/adr/0007-cache-strategy.md`).
- Each public function, type or module gets a **one-line** doc comment saying what it is for.
- Good: `// Retry once: the provider drops the first call after a cold start.`
- Bad: `// Increment i by one.` · a 15-line essay · a comment that contradicts the code.
- A comment that became false is fixed or deleted in the same change.

## Tests

- Unit tests sit next to the code or in the project's test folder, named after the behaviour tested.
- One behaviour per test; no test depends on another's order or on the network.
- Never skip, disable or loosen a test to get CI green. Fix the cause or ask.

## Docs and CHANGELOG

- `CHANGELOG.md` follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
  Subsections: `Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`, `Security`.
- **One change = one line**, written for a user, no wrap. Details go to the commit body or `docs/`.
- Never write a `## [x.y.z]` section outside a release branch (see `git-workflow`).
- Markdown tables are aligned in plain text so they read well in a diff.

## Secrets and dead code

- No secret in the repository, ever: tokens, passwords, keys, real `.env`. Commit `.env.example`
  with placeholder values only. A leaked secret is revoked first, then removed.
- No commented-out code: git history keeps it.
- No `TODO` without an issue number: `TODO(#42): …`.

## Dependencies

- Every new dependency is justified in the PR description: **why** (what it replaces), **health**
  (maintained, recent releases), **license** (compatible with the project's).
- Prefer the standard library or an existing dependency over a new one.
- Versions are pinned through the lock file, which is always committed.
- A new dependency family (framework, database, runtime) is an ADR, not just a PR line.

## Review checklist

Reviewers (human or agent) check the definition of done above, then that the diff has no secret,
no dead code, no orphan `TODO` and no unjustified dependency.
