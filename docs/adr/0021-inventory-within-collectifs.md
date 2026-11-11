---
title: "0021: Inventory visible within collectifs until sharing exists"
description: Each collectif manages its inventory with its members; sharing with others waits for visibility rules (V1.1).
---

| Status   | Date       | Deciders          |
|----------|------------|-------------------|
| Accepted | 2026-11-11 | @tritriper, Aloïs |

Refines [0020](../0020-platform-and-collectif-roles/) (what a platform member can browse) and the
"every validated user sees every item" boundary set for V0.6.

## Context

Up to V0.6 the platform was built as one shared catalogue: every validated user browses the whole
inventory and calls the owner. Talking with the first collectifs, the immediate need is different:
each collectif wants to keep **its own** inventory, with its members and responsibles, before it
opens anything to others. Opening everything by default also makes people reluctant to list what
they own. Sharing with other collectifs stays the goal, but it needs owners to choose who sees what,
which is the fine-grained visibility planned for V1.1.

## Decision

Until V1.1, an item is visible only to the people who keep it, not to every validated user.

A signed-in user sees an item when at least one holds:

| Rule                                                               | Why                                                      |
|--------------------------------------------------------------------|----------------------------------------------------------|
| owned by a collectif I belong to                                   | the collectif's inventory, shared with its members       |
| owned by me, or by a person who belongs to one of my collectifs    | what a member can bring to the collectif                 |
| stored in a location I manage (mine, or a collectif's I belong to) | I hold it, so I must see it (ADR 0009)                   |
| I am a platform admin                                              | support and moderation, as today (open point, see below) |

"Belong to" means responsible, and from V0.8 member too. Before V0.8 only responsibles belong to
a collectif.

- **Collectifs directory.** Every validated user sees the list of approved collectifs: name, city
  and description, never their items, locations or members. It is how one finds a collectif and asks
  to join it (from V0.8).
- **People.** A person's page, name and phone are shown to the people who share a collectif with
  them (and to admins). The contact form follows the item: whoever sees an item can write to it.
- **Search, dashboard, history, exports** only ever cover the items the user may see.
- **Approval is unchanged**: accounts and collectifs are approved by admins (and moderators from
  V0.8); joining a collectif is approved by its responsibles. Approval by responsibles alone may
  come later.
- **The architecture stays ready for sharing.** One function decides whether a user sees an item
  (`canSeeItem`), and every listing filters through the same rule in SQL, so V1.1 adds rules
  (per-collectif defaults, circles of partner collectifs, per-item overrides) without touching
  pages. Ownership, locations, the city-only rule and the data model stay as they are.

Open point: should admins and moderators keep seeing every inventory, or only their own
collectifs' plus counts? Until decided, admins keep today's access.

## Alternatives

| Option                                     | Pros                 | Cons                                                                                 | Why not                                 |
|--------------------------------------------|----------------------|--------------------------------------------------------------------------------------|-----------------------------------------|
| Keep the shared catalogue                  | done in V0.6         | collectifs hesitate to list their gear; nothing is private                           | not what the first collectifs want      |
| Ship V1.1 visibility now                   | sharing from day one | circles, defaults and overrides to design, build and test before anyone uses the app | too big before first use                |
| Personal items visible to their owner only | most private         | a member cannot show what they can bring to their collectif                          | the collectif needs to see it           |
| Hidden collectifs, invitation links only   | nothing public       | no way to find a collectif to join                                                   | the directory shows no inventory anyway |

## Consequences

- V0.7 restricts browse, search, the item page, the person page and the collectif page to this rule
  (US-0.7.11); the collectif directory replaces "all equipment of a collectif" for outsiders.
- V0.6's "find another collectif's item" journey disappears until V1.1; "Find" now means finding
  equipment in my collectifs.
- `app/permissions.ts` gains `canSeeItem` and `canSeePerson`; each rule gets a test and a row in the
  permissions matrix, with a non-member actor that must be refused.
- The phone notice on the profile says who sees the phone: people who share a collectif with me.
- V1.1 becomes "Sharing": owners choose who else sees their items.
