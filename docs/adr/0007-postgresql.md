---
title: "0007: PostgreSQL as the database"
description: Relational data with constraints enforced in the database.
---

| Status   | Date       | Deciders   |
|----------|------------|------------|
| Accepted | 2026-11-06 | @tritriper |

## Context

The data is relational (users, collectifs, responsibles, locations, items) and carries invariants
that must hold even if application code is wrong, e.g. an item has exactly one owner.

## Decision

PostgreSQL, accessed through Remix 3 `data-table-postgres`. Invariants are enforced with
constraints in the schema, e.g. `CHECK (num_nonnulls(owner_collectif_id, owner_user_id) = 1)`.
Migrations are versioned in the repository and run at startup.

## Alternatives

| Option | Pros             | Cons                                     | Why not                          |
|--------|------------------|------------------------------------------|----------------------------------|
| SQLite | no server to run | single writer, weaker constraint support | several collectifs write at once |
| MySQL  | widely known     | no `num_nonnulls`, weaker CHECK history  | no advantage here                |

## Consequences

- Backups with `pg_dump`, stored off the server (V1.0 checklist).
- Tests need a PostgreSQL instance (container in CI).
