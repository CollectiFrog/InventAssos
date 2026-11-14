---
title: "0031: Icon actions, a contextual « + », fewer frames, hints on hover"
description: One icon shape per kind of action on an object; the top bar's « + » follows the page; flat panels; field hints as tooltips.
---

| Status   | Date       | Deciders   |
|----------|------------|------------|
| Accepted | 2026-11-14 | @tritriper |

Continues [0030](../0030-lighter-shell/) inside the pages. Amends the page templates of
[0022](../0022-sidebar-navigation-on-computers/) on frames only.

## Context

After 0030 lightened the shell, the pages still felt heavy (field review, 14 November 2026): an
item's page stacked up to three bordered cards of text buttons; every list item, empty state and
settings section sat in a frame; a collectif's page repeated « Ajouter du matériel » under the top
bar's « + »; 23 field hints added grey paragraphs to the forms; the home page showed a second search
field under the top bar's one. The maintainer asked that **actions of the same kind always look the
same**.

## Decision

- **Actions on an object are square icon buttons**, one icon per kind, everywhere: edit (pencil),
  move, archive, delete and ask to delete (bin, in the danger colour), moderate (flag), import
  (upload), export (download), add (« + », with a word beside it when it adds something other than
  equipment: « + Lieu »). They sit together in one `icon-toolbar` beside the
  title. Their names stay in a visually hidden span and in `title` (tooltip on hover), so screen
  readers and voice control keep them (`app/ui/icons.tsx`).
- **Text buttons stay** for form submissions (Enregistrer, Envoyer, Accepter, Refuser), invitations
  in empty states, contact (Appeler, SMS, Écrire) and settings actions; within each kind they share
  one style.
- **The top bar's « + » always adds equipment**, already set to the collectif on its page, which
  drops its own « Ajouter du matériel ». Adding a place stays a button in the page, written
  « + Lieu » so it is not taken for the top bar's « + ».
- **Fewer frames**: a card keeps a soft surface only in grids (collectifs directory, item grid);
  lists of cards become rows divided by a line; side panels, empty states and settings sections are
  flat; tables lose their outer border.
- **Text hints show on hover**: an « i » after the label and the field's `title` carry them, and a
  visually hidden paragraph keeps them in `aria-describedby`. A hint holding a link stays visible.
- The home page's search shows on phones only; quieter titles and spacing; the visitor home page no
  longer shows the database status (`/readyz` does).
- On phones, Mon compte hides each section's explanation; the title is enough.

## Alternatives

| Option                                   | Pros                     | Cons                                          | Why not                         |
|------------------------------------------|--------------------------|-----------------------------------------------|---------------------------------|
| Rare actions as text links               | lighter, still explicit  | the same kind of action takes two shapes      | the maintainer wants one shape  |
| « Plus d'actions » menu (`<details>`)    | one button               | a click more, the menu still needs labels     | icons are as light, one click   |
| Icons with labels on wide screens        | explicit where room is   | two looks to keep                             | tooltips are enough             |

## Consequences

- On touch screens a tooltip does not show: the icons must stay conventional, and the user guide
  lists them.
- New object actions use `IconLink` or `IconButton`; tests look for the hidden names.
