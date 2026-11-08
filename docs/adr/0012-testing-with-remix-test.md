---
title: "0012: Tests with remix/test against a real PostgreSQL"
description: The Remix test runner, router-level tests, one shared test database.
---

| Status   | Date       | Deciders              |
|----------|------------|-----------------------|
| Proposed | 2026-11-08 | @claude (nightly run) |

## Context

Every permission rule must have an automated test (`AGENTS.md`), and most rules depend on data:
who owns an item, who manages a location. Invariants are SQL constraints (ADR 0007), so a fake
database would not test them.

## Decision

- Tests use `remix/test` and `remix/assert`, shipped with Remix: no extra test dependency.
- Most tests are **router tests**: they send a `Request` to `createAppRouter(deps)` and check the
  `Response`, so middleware, permission checks and SQL run as in production.
- Tests run against a dedicated PostgreSQL database (`TEST_DATABASE_URL`, default
  `inventassos_test`). `test/setup.ts` migrates it once; each test file empties the tables.
- Test files run one at a time (`remix.json` → `test.concurrency: 1`) because they share the database.

## Alternatives

| Option                     | Pros                     | Cons                             | Why not                      |
|----------------------------|--------------------------|----------------------------------|------------------------------|
| `node:test`                | built in                 | no router or browser helpers     | `remix/test` is a superset   |
| Vitest                     | popular, fast watch mode | one more dependency family       | Remix already ships a runner |
| SQLite in memory for tests | no server to run         | different SQL, no `num_nonnulls` | would not test constraints   |
| One database per test file | parallel files           | slower setup, more moving parts  | suite is small for now       |

## Consequences

- `make test` needs PostgreSQL: `make db` locally, a service container in CI.
- When the suite grows slow, revisit with one schema per worker before dropping real SQL.
