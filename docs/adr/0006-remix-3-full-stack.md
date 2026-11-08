---
title: "0006: Remix 3 for both UI and server"
description: One Remix 3 application, no separate backend.
---

| Status   | Date       | Deciders   |
|----------|------------|------------|
| Accepted | 2026-11-06 | @tritriper |

## Context

The platform is a small CRUD web app with server-side permission checks, file upload and e-mail.
It is built and maintained by volunteers. A Rust API behind a Remix front was considered first.

## Decision

A single Remix 3 application serves the UI and runs the server code, including database access.
Remix 3 provides routing, sessions, CSRF protection, multipart parsing, S3 file storage, a
PostgreSQL data layer (`data-table-postgres`), schema validation and a test runner.

## Alternatives

| Option                   | Pros                    | Cons                               | Why not                         |
|--------------------------|-------------------------|------------------------------------|---------------------------------|
| Remix 3 front + Rust API | fast, typed backend     | two stacks, two deployments        | too much for a volunteer team   |
| React Router 7           | mature, large ecosystem | not the framework we want to learn | Remix 3 covers the need         |
| Rust full stack          | one fast language       | thin UI ecosystem                  | slower to build forms and pages |

## Consequences

- One language (TypeScript), one image, one deployment.
- Remix 3 is new (stable 2026-10-01; `@remix-run/ui` still 0.x): pin versions, keep our own simple
  components, expect breaking changes in UI packages.
- Coding agents must read the Remix 3 docs first: most were trained before it (see `AGENTS.md`).
