---
title: "0004: Git flow with dev, release branches and Conventional Commits"
description: Branching model, merge strategies, SemVer and the tag-driven release.
---

| Status   | Date       | Deciders   |
|----------|------------|------------|
| Accepted | 2026-11-07 | @tritriper |

## Context

We want an integration branch separate from released code, releases that are easy to audit,
and versions computed from history rather than guessed.

## Decision

- `main` (released), `dev` (integration, default). `feat/…` and `fix/…` from `dev`, back by
  squash-merged PR. `release/vX.Y.Z` from `dev` into `main` by merge commit, tag `vX.Y.Z`,
  then `main` merged back into `dev`.
- Conventional Commits, enforced on PR titles (they become the squash commit).
- Semantic Versioning. The tag triggers the release workflow.

Details: `.ia/skills/git-workflow/SKILL.md`.

## Alternatives

| Option                    | Why not                                             |
|---------------------------|-----------------------------------------------------|
| Trunk-based on `main`     | user docs and releases would follow unreleased work |
| Free-form commit messages | no automatic version bump or changelog draft        |

## Consequences

Release and back-merge PRs must use merge commits, not squash, or `main` and `dev` diverge.
Branch protection must allow both merge methods.
