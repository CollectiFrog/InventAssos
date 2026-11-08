---
title: "0001: Record architecture decisions"
description: We record structural decisions as ADRs in docs/adr.
---

| Status   | Date       | Deciders   |
|----------|------------|------------|
| Accepted | 2026-11-07 | @tritriper |

## Context

Decisions made in chats, PRs or heads get lost. Agents and newcomers then undo them by accident.

## Decision

Every structural decision is an ADR in `docs/adr/NNNN-title.md`, from `0000-template.md`, with
Context, Decision, Alternatives and Consequences. An accepted ADR is never rewritten; a new ADR
supersedes it. ADRs are published with the developer docs.

## Alternatives

| Option                   | Why not                                   |
|--------------------------|-------------------------------------------|
| Decisions in the wiki    | not versioned with the code, not reviewed |
| Decisions in PR comments | impossible to find later                  |

## Consequences

A PR introducing a structural change includes its ADR. Reviewers ask for one when it is missing.
