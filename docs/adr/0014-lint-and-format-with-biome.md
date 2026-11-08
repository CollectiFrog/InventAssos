---
title: "0014: Lint and format with Biome"
description: One tool for linting and formatting TypeScript, plus remix doctor.
---

| Status   | Date       | Deciders              |
|----------|------------|-----------------------|
| Proposed | 2026-11-08 | @claude (nightly run) |

## Context

`make lint` must catch mistakes and keep a consistent style for volunteers using different
editors. Remix ships `remix doctor` (project conventions) but no code linter.

## Decision

`make lint` runs `biome check .` (lint + format + import order) then `remix doctor`.
Biome is configured in `biome.json`: 2 spaces, single quotes, no semicolons, 100 columns.
Markdown, YAML and the docs site are excluded.

## Alternatives

| Option                                | Pros             | Cons                             | Why not                  |
|---------------------------------------|------------------|----------------------------------|--------------------------|
| ESLint + typescript-eslint + Prettier | richest rule set | 3+ packages, two configs, slower | heavier for a small team |
| `tsc` only                            | no dependency    | no style, no lint rules          | too little               |

## Consequences

- One dev dependency (`@biomejs/biome`, MIT OR Apache-2.0, released monthly).
- `npx biome check --write .` fixes most findings.
