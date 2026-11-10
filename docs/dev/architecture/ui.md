---
title: UI
description: Pages, navigation and user journeys. Source of truth for the interface.
sidebar:
  order: 4
---

One responsive interface serves phones and computers: the same server-rendered pages, the same
URLs, a layout that adapts to the width ([ADR 0019](../../adr/0019-interface-conventions/)).
Pages and copy are in French; this page uses their French names.

## Principles

1. **Phone first.** Volunteers use the app in a storage room or a van; every page is designed at
   390 px wide first, then widened.
2. **Organised by task**, not by database table: find, list my equipment, manage a collectif.
3. **Search one tap away** from everywhere: it is task number one.
4. **Guide rather than block**: an empty list proposes the next action; a missing location is
   created from the add form.
5. **Owner and location always visible** on an item: ownership ≠ storage
   ([ADR 0009](../../adr/0009-ownership-and-locations/)), and only the city is shown to others.
6. **Plain French**, the words of the field ("Mon matériel", "Rangé à", "Appartient à").
7. **No client JavaScript, accessible**: plain links and forms (ADR 0015), WCAG AA.

## Site map

```mermaid
flowchart TB
  subgraph visitor[Visitor]
    connexion["/connexion"] --> envoyee["/connexion/envoyee"]
    inscription["/inscription"] --> insc_env["/inscription/envoyee"]
  end
  subgraph pending[Pending or rejected account]
    statut["/compte/statut"]
  end
  insc_env -. approval by an admin or a moderator .-> accueil
  subgraph app[Validated user · navigation bar]
    accueil["Accueil /"]
    rechercher["Rechercher /inventaire"]
    mon["Mon matériel /materiel · /lieux"]
    collectifs["Collectifs /collectifs"]
  end
  rechercher --> fiche["/materiel/:id"]
  accueil --> fiche
  mon --> ajouter["/materiel/nouveau"]
  ajouter --> fiche
  collectifs --> collectif["/collectifs/:slug"]
  fiche --> collectif
  fiche --> personne["/personnes/:id"]
  accueil -. header .-> compte["/compte/profil"]
  accueil -. header, admins and moderators .-> admin["/admin"]
```

## Navigation

| Entry        | URL                        | Holds                                                                      |
|--------------|----------------------------|----------------------------------------------------------------------------|
| Accueil      | `/`                        | search field, pending requests (admins, moderators), my collectifs, recent |
| Rechercher   | `/inventaire`              | text search, filters (category, collectif, city), results                  |
| Mon matériel | `/materiel`, tab `/lieux`  | my items, then one section per collectif I manage; tab Lieux               |
| Collectifs   | `/collectifs`              | list of collectifs, request a new one; each collectif page has tabs        |
| *Header*     | `/compte/profil`, `/admin` | account (initials), administration for admins and moderators               |

- **Phone (< 720 px):** a tab bar fixed at the bottom with the four entries, icon and label.
- **Computer (≥ 720 px):** the same four entries in the top bar, next to the name; content
  centred, at most 60 rem wide; lists become two- or three-column grids of cards.
- The current entry carries `aria-current="page"`; the bar is a `<nav aria-label>`.
- Detail pages have one link labelled « Retour » that goes back one page. The server builds it from
  the `Referer` header (sent for same-origin navigation, `Referrer-Policy: same-origin`) when it is
  an internal path, and falls back to the section's list page otherwise; no JavaScript, and it can
  never point off the site.
- Tabs inside a page (Mon matériel: Matériel, Lieux; collectif: Matériel, Lieux, Responsables,
  Membres from V0.8) are links to distinct URLs, so they work without JavaScript and can be shared.

## Journeys

Deduced from the user stories V0.2 to V0.8. Coloured steps wait for a person with approval rights.

```mermaid
flowchart LR
  subgraph j1[1 · Join · new volunteer]
    a1[Sign up] --> a2[E-mail: request received] --> a3{{Approval}} --> a4[Sign-in link] --> a5[Dashboard]
  end
  subgraph j2[2 · Find · any volunteer]
    b1[Dashboard] --> b2[Search and filters] --> b3[Item page] --> b4[Call, SMS or write]
  end
  subgraph j3[3 · List · own equipment]
    c1[Mon matériel] --> c2[Add] --> c3[No location? create one] --> c4[Fill the form] --> c5[Item visible]
  end
  subgraph j4[4 · Collectif · responsible]
    d1[Collectifs] --> d2[Request or join] --> d3{{Approval}} --> d4[Collectif page] --> d5[Locations and equipment]
  end
  subgraph j5[5 · Approve · admin or moderator]
    e1[Badge on the dashboard] --> e2[Queue] --> e3[Accept or refuse] --> e4[E-mail to the person]
  end
```

| Journey     | Stories                       | What must hold                                                         |
|-------------|-------------------------------|------------------------------------------------------------------------|
| 1 Join      | US-0.2.1 → US-0.2.5           | the pending page says how long it takes and whom to contact            |
| 2 Find      | US-0.6.1 → US-0.6.3, US-0.7.6 | three taps at most from the dashboard to the owner's phone             |
| 3 List      | US-0.4.2, US-0.5.1, US-0.7.4  | a location is created without leaving the add form                     |
| 4 Collectif | US-0.3.1 → US-0.3.5, US-0.8.3 | a responsible lands on the collectif page, "Ajouter du matériel" first |
| 5 Approve   | US-0.2.4, US-0.3.7, US-0.8.4  | one screen, Accept and Refuse on each row, undo right after            |

From V0.8, a request to join a collectif is approved by its responsibles, not by the platform.

## Pages

| Zone         | Pages                                                                                                            |
|--------------|------------------------------------------------------------------------------------------------------------------|
| Visitor      | `/connexion`, `/connexion/envoyee`, `/connexion/lien/:token`, `/inscription`, `/inscription/envoyee`             |
| Pending      | `/compte/statut`, `/compte/statut/redemander`                                                                    |
| Accueil      | `/`                                                                                                              |
| Rechercher   | `/inventaire`                                                                                                    |
| Item         | `/materiel/:itemId` and its `/modifier`, `/deplacer`, `/archiver`, `/contacter`                                  |
| Mon matériel | `/materiel`, `/materiel/nouveau`, `/lieux`, `/lieux/nouveau`, `/lieux/:locationId` (+ `/modifier`, `/supprimer`) |
| Collectifs   | `/collectifs`, `/collectifs/nouveau`, `/collectifs/:slug` (+ `/modifier`, `/devenir-responsable`)                |
| People       | `/personnes/:userId`                                                                                             |
| Account      | `/compte/profil`, `/deconnexion`                                                                                 |
| Admin        | `/admin` and its accept, refuse, disable and remove actions                                                      |

URLs are a contract: V0.7 changes what the pages show and how they are reached, not their URLs.

## Components

Every page is built from a few shared pieces in `app/ui/`, styled by `public/styles.css`:

| Piece       | Rule                                                                       |
|-------------|----------------------------------------------------------------------------|
| Button      | one primary per screen; 44 px high at least; a verb ("Enregistrer")        |
| Field       | visible label, hint under it, error in French under it, `aria-describedby` |
| Item card   | name, quantity, category, owner · city; the whole card is the link         |
| Tabs        | links to distinct URLs, current one marked                                 |
| Empty state | says why it is empty and offers the next action                            |
| Notice      | confirmation after every action (flash message), `role="status"`           |

## Lessons from the Matosthèque audit

The UX audit ([.ia/sources/matostheque-ux-audit.md](https://github.com/CollectiFrog/InventAssos/blob/dev/.ia/sources/matostheque-ux-audit.md))
ran the Matosthèque with test data. What it changes here: owner choice limited to me and my
collectifs and recalled before saving, accent-insensitive search (done), useful empty states,
errors as text, feedback after every action, return to the requested page after sign-in,
one-tap call and SMS, accessible contrast checked in CI, archive instead of delete (done).
QR labels, kits and check-lists are for later versions.
