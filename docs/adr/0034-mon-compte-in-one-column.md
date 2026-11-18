---
title: "0034: Mon compte in one column, the account at the foot of the sidebar"
description: Mon compte becomes rows « label · state | action », fields edited in their own row; computers reach it from the sidebar.
---

| Status   | Date       | Deciders   |
|----------|------------|------------|
| Accepted | 2026-11-18 | @tritriper |

Supersedes the Settings template of [0022](../0022-sidebar-navigation-on-computers/) for Mon compte, the phone point
of [0031](../0031-icon-actions-and-fewer-frames/) on Mon compte's explanations, and, on computers,
the account link of the top bar from [0030](../0030-lighter-shell/).

## Context

Mon compte showed four columns on a computer: the sidebar, an in-page table of contents, an
explanation per section, then its controls. Five of its sections were one sentence and one
button, and the primary « Enregistrer » stood out on a page that is mostly read. The maintainer
found it heavy. The study [Mon compte, lighter settings](../../dev/design/account-settings-study/)
compared recent products: a small personal account fits one page and one bounded column, each
setting showing its state rather than an explanation (Google Account 2025, Android, GOV.UK, Stripe,
Notion, Claude.ai).

## Decision

- **One column of about 40rem, no table of contents.** Two groups of rows « label · state |
  action », separated by a rule: the profile (e-mail, name, phone), then the account (Apparence,
  Mes collectifs, Mot de passe, Session, Supprimer mon compte, last). Version and guide are a
  footer line. No explanation sentences, except the phone's hint (behind the field's ⓘ) and one
  line under deletion.
- **Name and phone are edited in their own row, one at a time, and the row keeps its shape.** At
  rest the row shows the value and a pencil icon (« Modifier : … »). The pencil is a link to
  `/compte/profil?modifier=nom` (or `telephone`): the page comes back with that row only turned
  into a form, the value replaced by a focused field, the pencil by two icons, ✓ « Enregistrer »
  (submit) and ✕ « Annuler » (a link back to the page). No JavaScript, no layout change around
  the row. The server sends back the row of a field in error, open. The form sends only that
  field; the server keeps the stored value of a field left out. `EditableSettingRow` and
  `SettingRow` live in `app/ui/settings.tsx`.
- **Computers reach Mon compte from the foot of the sidebar** (initials and « Mon compte », under
  the theme switch), in the rail and the sidebar; the top bar's initials are hidden from 720 px.
  Phones keep the initials at the top right. Administration stays a navigation entry (0033).

## Alternatives

| Option                                    | Pros                         | Cons                                            | Why not                  |
|-------------------------------------------|------------------------------|-------------------------------------------------|--------------------------|
| Summary list, edits on sub-pages (Google) | calmest                      | one page more to change a phone; a new route    | more steps for the most common change |
| Drop the contents, ⓘ per section          | smallest change              | keeps a title column far from its controls       | little lighter           |
| Inset groups (iOS)                        | clear groups                 | brings back the frames 0031 removed              | kept for when Mon compte grows |
| One form, always open, « Enregistrer »    | one save for both fields     | the primary button stands out on every visit     | the reported problem     |
| `<details>` opening the field under the row | no page load               | the row grows and the layout moves on edit       | the maintainer wants the row unchanged |

## Consequences

- Four columns become two; the page reads as a list of states.
- Changing the name or the phone takes one click more (the pencil, which reloads the page), and
  only one field is saved at a time. The field gets `autofocus`: the person has just asked for it.
- If Mon compte grows well beyond its eight settings (two-factor sign-in, notifications), inset
  groups or sub-pages become worth a new decision.
