---
title: "0037: No top bar on computers, adding in the pages"
description: Computers lose the top bar (search and « + »); each page adds what it lists, and pages named by the navigation hide their title.
---

| Status   | Date       | Deciders   |
|----------|------------|------------|
| Accepted | 2026-11-18 | @tritriper |

Supersedes the top bar of [0030](../0030-lighter-shell/) and the « + » that follows the page of
[0031](../0031-icon-actions-and-fewer-frames/); their icon actions and lighter pages stand.

## Context

The top bar held a search field and a « + » to add equipment; on computers Mon compte had already
moved to the foot of the sidebar ([0034](../0034-mon-compte-in-one-column/)). In the field, a
tester who had added a first item could not find where to add the rest: Mon matériel only offered
« Ajouter du matériel » while empty, and the « + » sat at the far right edge of a wide screen. The
search field repeated the Rechercher entry of the navigation, and each section's title repeated the
highlighted entry beside it.

The maintainer compared one global « + » opening a menu (matériel, collectif, lieu) with adding in
the pages, and chose the pages: an add button in a page knows its context (the collectif as owner,
the place), a global menu does not, and creating a collectif is rare.

## Decision

- **Computers have no top bar.** Search is the Rechercher entry; the home page starts with its own
  search field. Phones keep a top bar with the brand and the account; their bottom tab bar already
  has Rechercher, so no magnifier is added.
- **Pages add what they list** with a labelled icon link: « + Matériel » in Mon matériel and in a
  collectif's Matériel tab (owner preset), « + Lieu » in the Lieux tabs. `Layout` loses `add`.
- **Pages named by a navigation entry** (Accueil, Rechercher, Mon matériel, Collectifs,
  Administration) keep an `<h1>` for screen readers only; other pages show their title.
- **Rechercher puts the search field first**, then one menu of links per filter (`<details>`, no
  script, [0015](../0015-server-rendered-html/)), the results at full width.

## Alternatives

| Option                                     | Pros                       | Cons                                                | Why not                              |
|--------------------------------------------|----------------------------|-----------------------------------------------------|--------------------------------------|
| One global « + » with a menu or radial     | one place to add anything  | loses the page's context; animation and a11y costs  | context matters more (maintainer)    |
| Keep the top bar for search                | search from anywhere       | repeats Rechercher; a band of screen for one field  | the entry is one click away          |
| A magnifier in the phone's top bar         | search at the top          | a second door to the same page                      | the tab bar is under the thumb       |
| Filter menus as `popover`                  | closes on an outside click | positioning needs anchor CSS, not everywhere yet    | `<details>` places it under its button |

## Consequences

- Sticky panels stick to the top of the window, not under the bar.
- A filter menu stays open until a choice is made or its button is clicked again; a choice reloads
  the page, so it never stays open by mistake for long.
- Tests no longer look for the top bar's search or « + »; they check the in-page buttons.
