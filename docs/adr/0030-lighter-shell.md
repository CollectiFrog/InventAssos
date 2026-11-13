---
title: "0030: A lighter shell: icon buttons, Administration in Mon compte"
description: The top bar shows a magnifier and a "+"; Administration leaves the navigation for a section of Mon compte.
---

| Status   | Date       | Deciders   |
|----------|------------|------------|
| Accepted | 2026-11-13 | @tritriper |

Amends [0022](../0022-sidebar-navigation-on-computers/) on two points: the top bar's buttons and
where Administration is reached. Everything else in 0022 stands.

## Context

After the first weeks of use, the shell feels heavy: the top bar repeats words already said by the
search field ("Rechercher") and spends a wide button on "Ajouter du matériel"; Administration takes
a place in the sidebar and a text link in the phone's top bar, for the few people who use it.

## Decision

- The top bar's **search button shows a magnifier** and **"Ajouter du matériel" becomes a "+"**,
  both square 44 px buttons. Their names stay in a visually hidden span (screen readers, voice
  control, WCAG 2.5.3) and in `title` (a tooltip for the mouse).
- **Administration leaves the navigation** (sidebar foot, phone top bar) and becomes a section of
  **Mon compte**, shown to admins and moderators only, with the number of pending requests and
  « Ouvrir l’administration ». The admin pages mark the account link as current and lead back to
  Mon compte (breadcrumb on computers, « Retour » on phones).
- The home dashboard keeps its pending-requests link for staff, so new requests stay one click away.

## Alternatives

| Option                                     | Pros                       | Cons                                        | Why not                         |
|--------------------------------------------|----------------------------|---------------------------------------------|---------------------------------|
| Keep the labels, smaller                   | no learning                | still two words for one action              | does not lighten much           |
| Icon and label on wide screens only        | explicit where room exists | two looks to keep, media queries per button | the icons are conventional      |
| Keep an Administration icon in the sidebar | one click for staff        | the heaviness the field reported            | the dashboard link is enough    |

## Consequences

- Administration is two clicks from any page (account, then « Ouvrir l’administration »), one from
  the home dashboard when requests wait.
- The accessibility check keeps covering the top bar: icon buttons must keep their hidden names.
