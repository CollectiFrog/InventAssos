---
title: "0013: Plain SQL migrations, applied at startup"
description: remix/data-table migrations in db/migrations, run before the server listens.
---

| Status   | Date       | Deciders              |
|----------|------------|-----------------------|
| Proposed | 2026-11-08 | @claude (nightly run) |

## Context

ADR 0007 asks for versioned migrations that run at startup. The app runs as a single container,
possibly with several replicas later.

## Decision

- Migrations are hand-written SQL in `db/migrations/NNNN_slug/up.sql` (and `down.sql` when
  reversible), run by `remix/data-table`'s migration runner.
- `server.ts` applies pending migrations **before** listening. The PostgreSQL adapter takes an
  advisory lock, so replicas starting together apply each migration once.
- An applied migration is never edited (the runner checks checksums): add a new one.
- `remix db status|migrate|rollback` work locally through `remix.json`.

## Alternatives

| Option                      | Pros                    | Cons                                 | Why not                        |
|-----------------------------|-------------------------|--------------------------------------|--------------------------------|
| node-pg-migrate, Knex       | mature                  | extra dependency, JS migration files | Remix ships a runner           |
| Drizzle / Prisma migrations | schema-first, generated | ORM lock-in, generated SQL to review | we write constraints by hand   |
| Kubernetes init job         | migrations apart        | one more manifest in the infra repo  | startup + lock is enough today |

## Consequences

- A failing migration stops the container from starting: the readiness probe never passes and
  the previous version keeps serving.
- Rolling back the image does not roll back the schema: migrations stay backward compatible with
  the previous release (add columns, do not drop them in the same release).
