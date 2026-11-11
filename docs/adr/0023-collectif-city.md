---
title: "0023: A collectif states its city"
description: The collectifs directory shows a city per collectif, stored on the collectif and required.
---

| Status   | Date       | Deciders   |
|----------|------------|------------|
| Accepted | 2026-11-11 | @tritriper |

Completes [0021](../0021-inventory-within-collectifs/), whose directory shows "name, city and
description" of every collectif.

## Context

Until V0.6 a collectif had a name, a description and a contact phone; only its locations had a
city. The directory (US-0.7.12) lists every collectif to every validated user, with its city, so
that people find theirs; it must not show the locations of a collectif one does not belong to.

## Decision

`collectifs.city` is a required text field, set when the collectif is requested and editable by its
responsibles and the admins, like the description. Migration 0010 fills it for existing collectifs
from their oldest location; a collectif without a location keeps an empty city until a responsible
fills it in. The directory searches the name and the city, ignoring case and accents.

## Alternatives

| Option                                 | Pros                       | Cons                                                         | Why not                          |
|----------------------------------------|----------------------------|--------------------------------------------------------------|----------------------------------|
| Derive the city from the locations     | nothing new to type        | no city without a location; several cities to choose between | a new collectif has no location  |
| Leave the city out of the directory    | no migration               | collectifs with similar names are hard to tell apart         | the story asks for it            |

## Consequences

- The request and edit forms gain a required « Ville » field; the admin queue shows it.
- The city is public within the platform, like the name: it says where a collectif works, not
  where its equipment is stored.
