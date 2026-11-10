---
title: "0009: Separate ownership from storage location"
description: An item has one owner and one location, each a collectif or a person.
---

| Status   | Date       | Deciders   |
|----------|------------|------------|
| Accepted | 2026-11-06 | @tritriper |

## Context

Equipment belongs either to an association or to a member, and is often stored somewhere else:
a member's amplifier kept in the collectif's storage room. In the Matosthèque, items belong to a
person and become orphans when that person leaves.

## Decision

- An **item** has exactly one owner: a collectif **or** a user.
- An item is always stored in exactly one **location**.
- A location belongs to a collectif **or** a user; both can have several.
- Both "exactly one" rules are database constraints (ADR 0007).
- An item can be edited by its owner and by whoever manages its location.

## Alternatives

| Option                  | Why not                                                |
|-------------------------|--------------------------------------------------------|
| Owner only, no location | nobody knows where the equipment is                    |
| Location implies owner  | cannot express a member's item stored at the collectif |

## Consequences

- Permission checks combine owner and location rules (`docs/dev/architecture/permissions.md`).
- Deleting an account must decide what happens to the person's items (open point, V1.0).
