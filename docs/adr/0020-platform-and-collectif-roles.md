---
title: "0020: Platform roles (admin, moderator, member) and collectif roles (responsible, member)"
description: Moderators share the approval queue; responsibles approve their own members.
---

| Status             | Date       | Deciders   |
|--------------------|------------|------------|
| Superseded by 0028 | 2026-11-09 | @tritriper |

Supersedes [0011](../0011-platform-admin-validation/).

## Context

[ADR 0011](../0011-platform-admin-validation/) kept one platform role (admin) and one collectif role
(responsible) until the core was validated. With V0.6 the core exists. Two limits appear: the admin
alone handles every request, and a collectif's volunteers who keep its equipment must either become
responsible (and manage locations and people) or cannot edit anything.

## Decision

**Platform roles**, held by every validated account:

| Role      | Who                                     | Can                                                                                                                              |
|-----------|-----------------------------------------|----------------------------------------------------------------------------------------------------------------------------------|
| Admin     | e-mails in `PLATFORM_ADMIN_EMAILS` only | everything a moderator can, plus name and remove moderators                                                                      |
| Moderator | named by an admin in the app            | approval queue (accounts, collectifs), disable and re-enable accounts, archive an abusive item; never on an admin or a moderator |
| Member    | any validated account                   | browse, manage own locations and items, request collectifs, ask to join collectifs                                               |

**Collectif roles**, per collectif:

| Role        | Can                                                                                                                     |
|-------------|-------------------------------------------------------------------------------------------------------------------------|
| Responsible | everything a member can, plus the collectif's profile, locations and members (accept, reject, remove, make responsible) |
| Member      | add, edit, move and archive the collectif's items; see the full address of its locations                                |

- A request to join a collectif is approved by its responsibles, not by the platform.
- A responsible is added or removed by a responsible of the same collectif, an admin or a moderator.
- New accounts and new collectifs are still approved centrally, by admins and moderators.
- Responsibles may change the condition, the location and every property of the items they manage.
- Every rule is in [Permissions](../../architecture/permissions/) with a test, as before.

## Alternatives

| Option                                             | Pros            | Cons                                              | Why not                         |
|----------------------------------------------------|-----------------|---------------------------------------------------|---------------------------------|
| Keep admin + responsible only                      | simplest        | admin bottleneck; no way to help without managing | blocks real use after V0.6      |
| Moderators named by env variable                   | no admin screen | a deployment to add a moderator                   | moderators change often         |
| Members approved by the platform                   | one queue       | the admin cannot judge who belongs to a collectif | responsibles know their members |
| Finer collectif roles (viewer, editor, treasurer…) | flexible        | more screens, more rules to test                  | not needed by the use cases     |

## Consequences

- V0.8 adds a `role` for moderators and a collectif membership with a role (`responsible` or
  `member`); the data model and the permissions matrix change in that version.
- The admin queue becomes the moderation queue; each collectif page gets a Membres tab.
- Fine-grained visibility (V1.1) can build on collectif membership.
