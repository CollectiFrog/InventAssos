---
title: "0035: A collectif is renamed in the app, its address follows"
description: Responsibles, moderators and admins rename a collectif from « Modifier la présentation »; the slug follows the name.
---

| Status   | Date       | Deciders   |
|----------|------------|------------|
| Accepted | 2026-11-18 | @tritriper |

## Context

A collectif's name was fixed at its request: the edit form said « contactez un administrateur »,
yet no screen let an administrator change it. Associations rename themselves, and the field asked
for the name to be editable by its responsibles, moderators and admins. The name gives the slug
(`/collectifs/<slug>`), which is also how the platform tells two collectifs apart: two names with
the same slug are the same collectif (unique index on `slug` for non-rejected collectifs).

## Decision

- **« Modifier la présentation » holds the name**, with the city, description and phone. Its
  responsibles, active moderators and admins may edit it (moderators gain the whole presentation).
- **The slug follows the name.** A name whose slug another pending or active collectif holds is
  refused (« Un autre collectif porte déjà ce nom. »), ignoring case and accents as at the request.
- A rename is logged as `collectif.renamed`, IDs only; other changes stay `collectif.updated`.

## Alternatives

| Option                                   | Pros                         | Cons                                                  | Why not                                  |
|------------------------------------------|------------------------------|-------------------------------------------------------|------------------------------------------|
| Keep the slug, change only the name      | old links keep working       | address and name drift apart; uniqueness on two keys  | one rule for « same collectif » is safer |
| Keep old slugs as redirects (new table)  | old links and new names      | a table and a lookup for a rare event                 | not worth it before it is asked for      |
| Admins only rename                       | fewer hands on the name      | the reported problem: responsibles cannot fix theirs  | the field asked for responsibles too     |

## Consequences

- After a rename, old links to the collectif (bookmarks, e-mails already sent) lead to « page
  introuvable »; the form says so under the name field.
- The permission matrix's « Edit C's profile » row now allows moderators.
