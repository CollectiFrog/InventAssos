---
title: "0033: Administration back in the navigation"
description: Admins and moderators reach Administration from a fifth navigation entry, no longer from Mon compte.
---

| Status   | Date       | Deciders   |
|----------|------------|------------|
| Accepted | 2026-11-18 | @tritriper |

Supersedes the Administration point of [0030](../0030-lighter-shell/); its top bar buttons stand.

## Context

[0030](../0030-lighter-shell/) moved Administration from the navigation to a section of Mon compte,
to lighten the shell. In use, admins and moderators go there often, and looking for it among the
settings (« Mon compte », then « Ouvrir l'administration ») is a detour. The maintainer asked for it
in the general navigation again.

## Decision

- Admins and moderators get a **fifth navigation entry, « Administration »** (shield icon), after
  Collectifs: in the sidebar, the rail and the phone's bottom tab bar. Other users keep four entries.
- The admin pages mark this entry as current, like any section: no breadcrumb nor « Retour » to
  Mon compte, and the account link is no longer marked on them.
- **Mon compte loses its Administration section.** The home dashboard keeps the pending requests
  with a direct link.

## Alternatives

| Option                                   | Pros                     | Cons                                   | Why not                     |
|------------------------------------------|--------------------------|----------------------------------------|-----------------------------|
| Keep it in Mon compte (0030)             | four entries for all     | two clicks, hidden among settings      | the reported problem        |
| Both: the entry and the Mon compte section | found from either place | two ways to keep, a repeat in settings | one place is enough         |
| A link in the top bar                    | always visible           | heavier top bar, against 0030          | the navigation is its place |

## Consequences

- Administration is one click from any page for staff; the phone's tab bar holds five entries for
  them (still at least 44 px wide on a 320 px screen).
- `Section` gains `admin`; the server still checks every admin page (deny by default), the entry is
  only a shortcut.
