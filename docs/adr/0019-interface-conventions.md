---
title: "0019: One responsive interface, four-entry navigation"
description: Same pages for phones and computers, bottom tab bar on phones, sober style, WCAG AA.
---

| Status   | Date       | Deciders   |
|----------|------------|------------|
| Accepted | 2026-11-09 | @tritriper |

Partly superseded by [0022](../0022-sidebar-navigation-on-computers/): on computers the entries are
in a left sidebar, not the top bar, and content is fluid.

## Context

V0.2 to V0.6 built the pages story by story, without an interface model: the header grew to six
or seven links that do not fit on a phone, the home page does not lead to the main tasks, and
errors, confirmations and empty states differ from page to page. Volunteers mostly use the app
from a phone in a storage room or a van. No design system exists yet; one may come later.

## Decision

InventAssos has **one responsive interface**: the same server-rendered pages and URLs for phones
and computers, laid out by CSS ([ADR 0015](../0015-server-rendered-html/)).

- Four navigation entries: Accueil, Rechercher, Mon matériel, Collectifs. Account and
  administration are in the header.
- Below 720 px the entries sit in a tab bar at the bottom of the screen; from 720 px, in the top
  bar.
- Pages are built from shared pieces in `app/ui/` (button, field, item card, tabs, empty state,
  notice), described in [UI](../../architecture/ui/).
- Sober style until a design system exists: colours, spacing and type are CSS custom properties in
  `public/styles.css`, so a design system replaces values, not pages.
- Accessibility target WCAG 2.1 AA: contrast, 44 px touch targets, visible focus, labelled
  controls; an automated check runs in CI on the key pages.

## Alternatives

| Option                              | Pros                     | Cons                                           | Why not                 |
|-------------------------------------|--------------------------|------------------------------------------------|-------------------------|
| Two interfaces (mobile and desktop) | each tuned to its device | twice the pages, tests and bugs                | too much for volunteers |
| Hamburger menu on phones            | keeps the header small   | hides the main tasks behind a tap              | search must be one tap  |
| CSS framework or component library  | ready-made components    | new dependency family, often client JavaScript | conflicts with ADR 0015 |

## Consequences

- V0.7 rewrites the layout and the shared pieces, not the routes; URLs stay a contract.
- Every new page follows [UI](../../architecture/ui/) and uses the shared pieces.
- The CI gains an accessibility check; its tool is chosen in V0.7 (a dev dependency, justified in
  its PR).
- A future design system plugs into the custom properties and the shared pieces.
