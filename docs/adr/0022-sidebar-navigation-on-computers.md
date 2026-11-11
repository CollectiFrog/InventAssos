---
title: "0022: Sidebar navigation and fluid content on computers"
description: From 720 px the four entries move to a left sidebar (a rail below 1100 px); content uses the full width.
---

| Status   | Date       | Deciders   |
|----------|------------|------------|
| Accepted | 2026-11-11 | @tritriper |

Supersedes the computer part of [0019](../0019-interface-conventions/) ("from 720 px, in the top
bar") and the "content centred, at most 60 rem" rule of [UI](../../architecture/ui/). Everything
else in 0019 stands: one responsive interface, four entries, bottom tab bar on phones, no client
JavaScript, WCAG AA.

## Context

The V0.7 mock-up laid out computers as a phone column widened then centred: at 1440 px the pages
use 27 % to 72 % of the width, at 1920 px 20 % to 54 %. The most tool-like pages (account,
administration, import, forms) are the narrowest; the add form and the approval queue are a 390 px
phone frame. The top bar spends a full-width band on four links, gives no direct access to one
collectif, and search, task number one, takes two clicks. A desktop audit (11 November 2026)
compared inventory and admin tools (Snipe-IT, Sortly, Cheqroom, Shelf) and modern management apps
(Linear, Vercel, GitHub, Stripe, Shopify): all use a sidebar with fluid content, dense tables on
large screens, and settings pages split in sections.

## Decision

One `<nav>`, placed by CSS according to the window width:

| Width       | Navigation                                                                                                         |
|-------------|--------------------------------------------------------------------------------------------------------------------|
| < 720 px    | tab bar at the bottom, unchanged                                                                                   |
| 720–1099 px | rail of 84 px on the left: icon and label of the four entries                                                      |
| ≥ 1100 px   | sidebar of 240 px: four entries, "Mes collectifs" shortcuts (5 at most, then "Tous"), Administration at the bottom |

- From 720 px a **top bar** holds a real search field (it submits to `/inventaire`), "Ajouter du
  matériel" and the account link. Search is one keystroke away on every page.
- **Content is fluid**: no page-wide `max-width`; only running text (`68ch`) and form fields are
  limited. Above 2000 px the content stops at 1760 px.
- Window breakpoints (720, 1100, 1440) drive the shell only; components adapt to their container
  (`@container`, `repeat(auto-fill, minmax())`).
- **Four page templates**, shared by all pages: index (filters on the left, results), detail
  (content and a sticky side panel), settings (in-page contents, sections "explanation | card"),
  wizard (steps, work area, actions).
- **Dense lists by default on computers**: the search results and the collectif's equipment show as
  a table; `?vue=grille` switches to cards, `?tri=` sorts by a column. Below 720 px they stay a
  list of cards.
- **No modal window**: confirmations are pages (`/compte/supprimer`, `/materiel/:id/archiver`) or a
  `<details>` in place, so focus and Escape work without JavaScript.
- **Breadcrumb** above the title on computers; the « Retour » link stays on phones.
- Administration sections get their own URLs (`/admin/demandes`, `/admin/comptes`,
  `/admin/collectifs`, `/admin/moderateurs`, `/admin/categories`, `/admin/instance`); `/admin`
  shows the requests.

## Alternatives

| Option                                    | Pros                       | Cons                                                | Why not                       |
|-------------------------------------------|----------------------------|-----------------------------------------------------|-------------------------------|
| Keep the top bar, only remove `max-width` | almost free, no ADR        | search still two clicks, no access to one collectif | solves width, not navigation  |
| Collapsible sidebar                       | user chooses               | needs a cookie or JavaScript to remember            | automatic rail is enough      |
| List-detail panes (inbox style)           | browse many items in place | without JavaScript every click reloads both panes   | too costly without JavaScript |

## Consequences

- `app/ui/layout.tsx` renders the sidebar, the top bar and the template slots; the four entries stay
  one `<nav aria-label="Navigation principale">` moved by CSS, plus a separate `<nav>` for "Mes
  collectifs" and one for in-page contents.
- Each page with a sidebar runs one more small query (my collectifs, already needed by the
  dashboard).
- The accessibility check in CI covers the three shell widths (390, 1024, 1440 px).
- New URLs are added (`?vue=`, `?tri=`, `/admin/…`, `/compte/supprimer`); existing URLs keep their
  meaning.
