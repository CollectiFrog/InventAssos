---
title: "0028: Admins named in the app, next to those of the configuration"
description: Any admin names or removes admins on Administration › Équipe; PLATFORM_ADMIN_EMAILS stays the root.
---

| Status   | Date       | Deciders   |
|----------|------------|------------|
| Accepted | 2026-11-13 | @tritriper |

Supersedes [0020](../0020-platform-and-collectif-roles/).

## Context

[ADR 0020](../0020-platform-and-collectif-roles/) kept admins in `PLATFORM_ADMIN_EMAILS` only: a
new admin meant changing the deployment and restarting the app. In the field, admins want to
share the role from the app, as they already do for moderators. The list must still give the
platform an owner that nobody can lock out from the app.

## Decision

An admin is either **listed** in `PLATFORM_ADMIN_EMAILS` or **named** in the app (`users.role =
'admin'`). Both hold the same rights. Everything else in ADR 0020 stands.

- Any active admin names or removes admins and moderators on **Administration › Équipe**
  (`/admin/equipe`, formerly `/admin/moderateurs`), by the e-mail of a validated account.
- Nobody changes their own role, and a listed admin is never removed nor disabled from the app.
- An admin may disable or re-enable a named admin; a moderator never acts on any admin.
- Named admins receive the new-request e-mails, like listed admins and moderators.
- Each change is logged with IDs only; a moderator made admin logs both the removal and the naming.

## Alternatives

| Option                                  | Pros                         | Cons                                         | Why not                           |
|-----------------------------------------|------------------------------|----------------------------------------------|-----------------------------------|
| Keep admins in the variable only        | one source, no lock-out risk | a deployment for each new admin              | the field asked for it            |
| Only listed admins name other admins    | a named admin cannot spread  | listed admins become a bottleneck            | the maintainer chose all admins   |
| Move every admin into the database      | one model                    | no way back in if every admin is removed     | the list stays the recovery path  |

## Consequences

- `users.role` gains `admin` (migration 0018); `CurrentUser.isAdmin` is true for both kinds.
- The permissions matrix plays a named admin as a ninth actor, expected to match the listed admin.
- A compromised named admin can name others; a listed admin removes them, and the audit log tells
  who named whom.
