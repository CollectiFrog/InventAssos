---
title: "0002: AGENTS.md is the single source of agent rules"
description: CLAUDE.md imports AGENTS.md; context and skills live in .ia/.
---

| Status   | Date       | Deciders   |
|----------|------------|------------|
| Accepted | 2026-11-07 | @tritriper |

## Context

Several agents read the repository (Claude Code first, others too). Each looks for its own file.
Copying rules into each file makes them diverge, as seen in other projects where `CLAUDE.md` was a
copy of `AGENTS.md`, and where rules described code that had left the repository.

## Decision

- `AGENTS.md` at the root holds all rules. `CLAUDE.md` contains only `@AGENTS.md`, which Claude
  Code expands as an import (verified with the CLI on 2026-11-07).
- Agent context lives in `.ia/`: `context/`, `skills/`, `sources/`.
- Claude Code discovers skills in `.claude/skills/`; that path is a symlink to `../.ia/skills`
  (verified: skills load through it). `AGENTS.md` also lists skills for agents without discovery.
- Rules are short and kept true in review: a PR that makes a rule false fixes or deletes it.

## Alternatives

| Option                               | Why not                               |
|--------------------------------------|---------------------------------------|
| `CLAUDE.md` as a copy of `AGENTS.md` | diverges silently                     |
| Skills stored in `.claude/skills/`   | ties shared knowledge to one tool     |
| Rules spread in `.claude/rules/`     | grows stale, not read by other agents |

## Consequences

On Windows, `core.symlinks` must be enabled for the symlink; without it, skills are still reachable
through the table in `AGENTS.md`.
