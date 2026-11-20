---
title: UI guidelines
description: "The Linear-style design system: principles, tokens, screens, components, and what is still open."
sidebar:
  order: 1
---

AssoMatos is a shared equipment inventory for associations (stage, sound, light, events). Users
mostly **scan lists, filter, open an item and contact its owner**: the interface must be fast,
dense and calm. Direction: **Linear-style, in a light and a dark theme**
([ADR 0032](../../adr/0032-linear-style-design-system/)). Restraint is the point: no blurred
gradient blobs, no glowing hero, no purple everywhere.

Pages, URLs and templates stay those of [UI](../../architecture/ui/); this page says how they look.
Copy stays in French. Live reference: **`/dev/ui`** on any non-production instance
(`?theme=light|dark`).

## References

Screenshots and links: [`.ia/sources/ui/`](https://github.com/CollectiFrog/InventAssos/tree/dev/.ia/sources/ui)
(screenshots are local only, never committed). What we take:

| Reference            | Take                                                                   |
|----------------------|------------------------------------------------------------------------|
| Linear               | surface layering, density, 1 px borders, one accent, both themes       |
| Vercel Geist         | semantic token names, borders as 1 px rings, accessible greys          |
| Plane (AGPL: look)   | filters as chips, display options, empty states                        |
| Resend               | a restrained light theme                                               |
| Raycast              | one bold accent used sparingly                                         |
| Supabase, Stripe     | tables lead; a status is a small tinted badge with a word              |

Never copy code or assets from these products.

## Principles

1. **Content first, chrome last.** Greys carry the structure; colour only carries meaning.
2. **One accent** (Collecti'FROG purple): primary action, focus, selection, links. Nothing else.
3. **Depth through surfaces, not shadows.** canvas → panel → surface → raised, each one step
   lighter (dark) or whiter (light), separated by 1 px low-contrast borders.
4. **Dense but readable.** 13 px UI text, 36 px rows with a mouse, 44 px wherever a finger taps.
5. **Tables first.** The inventory is a list; lists are the main screens.
6. **Keyboard reachable.** Every control is a real link, button or field, with a visible focus.
7. **Same structure in both themes.** Only colour tokens change.

## Tokens

All values live in **`public/tokens.css`**; components never hard-code a colour, size, radius or
duration. Each colour is `light-dark(light, dark)`.

### Colour

| Token                                    | Light                  | Dark                     | Use                              |
|------------------------------------------|------------------------|--------------------------|----------------------------------|
| `--bg-canvas`                            | `#fcfcfd`              | `#08090a`                | app background                   |
| `--bg-panel`                             | `#f7f7f8`              | `#0f1011`                | sidebar, side panels, filters    |
| `--bg-surface`                           | `#ffffff`              | `#151618`                | cards, inputs                    |
| `--bg-raised`                            | `#ffffff`              | `#1c1d20`                | menus, popovers                  |
| `--bg-hover` / `--bg-selected`           | black 3.5 % / 6 %      | white 4 % / 7 %          | row hover, current nav entry     |
| `--border-subtle` / `--border` / `-strong` | black 6 / 9 / 15 %   | white 6 / 9 / 14 %       | separators, cards, hover         |
| `--border-control`                       | `#8b8d92`              | `#64666c`                | form controls (3:1, WCAG 1.4.11) |
| `--text-primary` / `-secondary` / `-tertiary` | `#1a1b1e` / `#4b4f57` / `#65696f` | `#f7f8f8` / `#b4b6bc` / `#8a8f98` | text levels, all ≥ 4.5:1 |
| `--accent` (fill)                        | `#595082`              | `#6b62a6`                | primary button, selection        |
| `--accent-text`                          | `#595082`              | `#aaa2dc`                | links, accent text               |
| `--accent-tonal` (+ `-hover`)            | `#ebeaf0`              | `#1c1a2b`                | secondary pills                  |
| `--danger-tonal` (+ `-hover`)            | `#f6e5e4`              | `#2e1210`                | danger pills                     |
| `--focus-ring`                           | `#595082`              | `#8b82c8`                | 2 px ring, 2 px offset           |
| `--danger` / `--danger-text`             | `#b42318`              | `#c5372e` / `#f47067`    | destructive actions, errors      |

`--accent-subtle` is the accent mixed at 12 % into the canvas (selected backgrounds, notices).

### Equipment states

Always **icon + word + colour**, on a 12 % tint (`StatusBadge`, `app/ui/status-badge.tsx`).

| State (label)               | Token                | Hue   | Shown today                                  |
|-----------------------------|----------------------|-------|----------------------------------------------|
| Disponible                  | `--status-available` | green | no: without loans the app cannot know        |
| Prêté                       | `--status-lent`      | amber | from loans (V1.3)                            |
| En réparation / Hors service | `--status-broken`   | red   | yes, from the condition « À réparer » / « HS » |
| Réservé                     | `--status-reserved`  | blue  | from bookings (V1.4)                         |
| Archivé                     | `--status-archived`  | grey  | yes                                          |

### Type, spacing, sizes

- **Inter** variable, self-hosted, optical sizes on (Inter Display for headings),
  `cv11`/`ss01`, `tabular-nums` in tables. Mono: the system monospace stack.
- Scale: `--text-xs` 12/16, `--text-sm` **13/20 default UI**, `--text-md` 14/22 forms and running
  text, `--text-lg` 16/24 section titles, `--text-xl` 20/28 page titles, `--text-2xl` 24/32 item
  title, `--text-3xl` 32/40 sign-in only, `--text-display` (fluid, 28 to 64 px) the landing page's
  title only. Weights 400 / 500 / 600; headings −0.015 em.
- Spacing on a 4 px base (`--space-1` … `--space-16`). Radii: 4 (badges), 6 (buttons, inputs),
  8 (cards, menus), 12 (sign-in card, dialogs).
- Controls 28 / **32** / 36 px with a mouse, buttons **30 px**; `--control` and `--button` become
  **44 px** below 720 px or with a coarse pointer. Rows 36 px (44 px on touch).

### Fields and buttons

- **Fields are underlined**: no box, no fill, one 1 px baseline in `--border-control` (3:1, WCAG
  1.4.11), darker on hover, accent and 2 px thick on focus, red when invalid, dashed when disabled.
  The label sits above in 12 px `--text-tertiary`, weight 500. A group of filters keeps a
  `--bg-panel` surface behind its fields, so a lone line never floats.
- **Buttons are pills**: primary filled with `--accent`; secondary tonal (`--accent-tonal`, text
  `--accent-text`); danger tonal red (`--danger-tonal`, `--danger-text`); ghost for quiet actions;
  icon buttons are circles. No frame on any button. Segmented controls, chips and the theme switch
  are pills too.
- Icons: **Lucide** shapes, 16 px, stroke 1.5, `currentColor` (`app/ui/icons.tsx`).
- Elevation: none in dark (surfaces and borders do it); a soft shadow in light for raised layers.
- Motion: 120 ms hover and press, 180 ms overlays, opacity and transform only; off with
  `prefers-reduced-motion`. The landing scene loops in `--duration-scene` (20 s).

## Screens

- **Shell**: sidebar 240 px on `--bg-panel` (rail below 1100 px, bottom tab bar below 720 px),
  current entry as a grey fill; theme switch at the foot of the sidebar. Top bar on phones only:
  brand and account ([ADR 0037](../../adr/0037-no-top-bar-on-computers/)).
- **Logo**: Collecti'FROG's frog (`public/logo.svg`), the `.logo` class paints it as a mask over
  `--accent-text`, so it follows the theme; before « AssoMatos » in the sidebar and the top bar,
  alone on the rail. The favicon is the frog in white on a `#595082` square.
- **Lists** (Rechercher, a collectif's equipment): Nom · Catégorie · Propriétaire · Ville · Qté,
  36 px rows, hairline separators, sortable headers; active filters as removable chips; Liste /
  Grille as a segmented control. On a phone, one compact row per item: the name, then « catégorie ·
  propriétaire · ville · × quantité ».
- **Item page**: title 24 px, state badge, owner and city; facts as a label/value list; a side panel
  on `--bg-panel` with where it is and how to reach the owner.
- **Forms**: one column of 560 px of underlined fields, labels above, errors under them, sticky
  footer with the submit pill and « Annuler ».
- **Sign-in, sign-up**: a centred card on the canvas; the only place with a (faint) gradient.
- **Landing page** (visitors, ADR 0039): no shell, one screen; an isometric scene drawn with a dark
  line and one colour per place (`--place-1` to `--place-4`, grey `--place-0` outside the
  collectif), the text on its empty side.
- Every list keeps its empty state (a sentence and the next action) and « Tout effacer » for filters.

## Accessibility

WCAG 2.1 AA in **both** themes: the axe check runs on the key pages at three widths and in the dark
theme; contrast values above were checked when chosen. Focus ring 2 px on every control. States
never by colour alone. `lang="fr"`, a label on every field.

## Not built yet

These parts of the brief need client JavaScript or data the app does not have; they wait for a
decision:

- **⌘K command palette**, `/` to search, ↑/↓ and Enter in lists, the **peek panel** and toasts:
  need client JavaScript, so an ADR superseding [0015](../../adr/0015-server-rendered-html/).
  Today search is the Rechercher page (and the home page's field) and an item opens its own page.
- **Copy the phone** button: needs the clipboard API (JavaScript); the number stays a `tel:` link.
- **Thumbnails** in lists: photos come with V0.11.
- Sidebar entries stay Accueil, Rechercher, Mon matériel, Collectifs (UI, ADR 0019); item pages
  stay at `/materiel/:id` (URLs are a contract).

## Open questions

- A soft or neumorphic light theme: possible later by changing tokens only.
