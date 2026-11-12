---
title: "0025: Admins and moderators see every inventory"
description: Settles the open point of ADR 0021 for the platform staff.
---

| Status   | Date       | Deciders   |
|----------|------------|------------|
| Accepted | 2026-11-12 | @tritriper |

## Context

[ADR 0021](../0021-inventory-within-collectifs/) keeps each collectif's inventory within the
collectif, and leaves one point open: should admins and moderators keep seeing every inventory?
V0.8 brings moderators ([ADR 0020](../0020-platform-and-collectif-roles/)), who archive an abusive
item (US-0.8.2) and may delete an item entered by mistake (US-0.8.9). A moderator who could not
open the item reported to them could do neither.

## Decision

Admins and active moderators see every item, person, location (name and city) and collectif page,
as admins did until now. `canSeeItem` and `itemScopeOf` treat both the same way.

Seeing is not managing: a moderator gets no right on items, locations or collectifs beyond
archiving an abusive item, and never sees a location's full address or notes, which stay with its
managers and the admins.

## Alternatives

| Option                        | Pros                                         | Cons                                                         | Why not                                        |
|-------------------------------|----------------------------------------------|--------------------------------------------------------------|------------------------------------------------|
| Item page only, from a link   | listings stay within their collectifs        | a second visibility rule to keep in step with `canSeeItem`   | more code and tests for little privacy gained  |
| Own collectifs only           | most private                                 | a reported item outside their collectifs cannot be handled   | moderation would not work                      |

## Consequences

- Searches and the collectif filter of a moderator cover every collectif.
- Naming a moderator is a trust decision: the admin page says what the role can do.
- When sharing arrives (V1.1), staff visibility is reconsidered with it.
