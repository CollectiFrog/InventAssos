---
title: "0011: Platform admin validates every request until V1.0"
description: Accounts, collectifs and responsibles are all approved centrally at first.
---

| Status             | Date       | Deciders   |
|--------------------|------------|------------|
| Superseded by 0020 | 2026-11-06 | @tritriper |

## Context

If the first person to register a collectif became its owner automatically, anyone could claim an
association that is not theirs. The user base is small at first.

## Decision

Until V1.0, the platform admin approves or rejects every new account, every new collectif and
every request to become responsible of a collectif. The first admins come from the
`PLATFORM_ADMIN_EMAILS` environment variable. There is one collectif role: **responsible**.

## Alternatives

| Option                                 | Why not now                                       |
|----------------------------------------|---------------------------------------------------|
| First registrant owns the collectif    | name squatting and impersonation                  |
| Responsibles approve their own members | more roles and flows before the core is validated |

## Consequences

- One admin queue screen lists all pending requests.
- Delegating approval to responsibles is a later change, with a new ADR.
