---
title: "0032: A Linear-style design system: tokens, two themes, Inter, Lucide"
description: One token file in both themes, a theme cookie, Inter and Lucide self-hosted, compact controls on a mouse; still no client JavaScript.
---

| Status   | Date       | Deciders   |
|----------|------------|------------|
| Proposed | 2026-11-17 | @tritriper |

Implements the design system that [0019](../0019-interface-conventions/) planned ("a design system
replaces values, not pages"). Amends 0019 on where the values live and on button height, and the
wizard template of [0022](../0022-sidebar-navigation-on-computers/) for the item form. Keeps
[0015](../0015-server-rendered-html/) (no client JavaScript) and the "no modal window" rule of 0022.

## Context

The maintainer chose a direction for the interface: Linear-style, in a light and a dark theme, dense
and calm, with one accent, the Collecti'FROG purple ([UI guidelines](../../design/ui-guidelines/)).
Until now the look was a few custom properties at the top of `public/styles.css`, a system font,
hand-drawn icons, one theme following the device, and every control 44 px high on every device.

## Decision

- **Tokens in one file**, `public/tokens.css`: surfaces, borders, text levels, accent, danger,
  equipment states, type scale, spacing, radii, control sizes, elevation, motion. `styles.css`
  reads only tokens. Each colour is written once as `light-dark(light, dark)`: the two themes cannot
  drift apart. Text is at least 4.5:1 and form-control borders 3:1 in both themes.
- **Themes**: `system` by default, `light` or `dark` chosen in Mon compte › Apparence or at the foot
  of the sidebar. The choice is a cookie (`assomatos_theme`, a year, HTTP only), so the server puts
  `data-theme` on `<html>`: no flash, no JavaScript. `POST /apparence`, open to every active
  account (permissions.md), sends back to the previous page.
- **Accent**: the purple of the mock-up (`#595082`) until the brand's exact value is known; a
  lighter fill in dark so white text and the focus ring both pass AA.
- **Inter** (variable, optical sizes for Inter Display) and **Lucide** shapes are shipped with the
  app: fonts in `public/fonts/` (SIL OFL), icon paths in `app/ui/icons.tsx` (ISC), credited in
  `THIRD-PARTY-NOTICES.md`. No new npm dependency; the CSP gains `font-src 'self'`.
- **Density**: 13 px UI text, 36 px rows and 32 px controls with a mouse; **44 px** for every control
  below 720 px or with a coarse pointer (`@media (pointer: coarse)`), so touch targets stay as
  0019 asked where fingers are used.
- **Item form**: one column of 560 px with a sticky « Ajouter / Enregistrer · Annuler » footer,
  instead of two fields per row. Import steps keep the wide wizard.
- **Equipment states** are a tinted badge with icon and word. Today only « Archivé » and « À
  réparer / Hors service » (from the condition) are shown: without loans the app cannot say an item
  is available.
- **`/dev/ui`** shows every token and shared component in both themes (`?theme=`); it answers 404
  in production.
- Biome's `noDescendingSpecificity` is off for `public/*.css`: the stylesheet is ordered by
  component, and that rule would force one global order for every `svg`, `a` or `form` tail.

## Alternatives

| Option                                         | Pros                              | Cons                                              | Why not                                     |
|------------------------------------------------|-----------------------------------|---------------------------------------------------|---------------------------------------------|
| Two token blocks (`:root`, `[data-theme]`)     | works in older browsers           | every colour written twice, plus a media query    | `light-dark()` is in every current browser  |
| Theme in `localStorage` with a script          | no server round trip              | client JavaScript, flash before the script runs   | ADR 0015; the cookie renders right at once  |
| Inter from Google Fonts, icons from an npm pkg | nothing to vendor                 | third-party request (privacy, CSP), a dependency  | self-hosting is two files and some paths    |
| Command palette, peek panel, ↑/↓ in lists      | the full Linear experience        | needs client JavaScript and modal-like panels     | waits for an ADR superseding 0015           |
| 44 px controls everywhere                      | one size                          | lists and forms twice as tall with a mouse        | `pointer: coarse` keeps 44 px for fingers   |

## Consequences

- Changing a colour, size or duration is an edit of `tokens.css`; a component never hard-codes one.
- A new component is added to `/dev/ui` and checked in both themes; the axe check keeps covering
  the dark theme.
- ⌘K, the peek panel, list keyboard navigation, toasts and the copy-the-phone button need client
  JavaScript: they are listed as open in the guidelines, for a later ADR.
- The brand's exact purple, a logo and photos in lists (V0.11) are open questions for the
  maintainer.
