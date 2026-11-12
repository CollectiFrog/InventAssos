---
title: Permissions
description: Who can do what. Every rule is checked on the server and has a test.
sidebar:
  order: 3
---

**Moderator** means: an active account an admin named on `/admin/moderateurs` (`users.role`,
US-0.8.1). A listed admin is never treated as a moderator. A moderator never acts on an admin or
another moderator: not on their account (disable, re-enable), nor on their responsible role, nor on
the items they personally own (archive as abusive, delete). A moderator sees every inventory like an admin
([ADR 0025](../../adr/0025-staff-see-every-inventory/)), without any manager right.

**Platform admin** means: the account's e-mail is listed in `PLATFORM_ADMIN_EMAILS`. The variable
is read once at startup (`loadConfig()`), and every request checks the signed-in e-mail against
that list (`context.currentUser.isAdmin`). A listed e-mail becomes an active account at its first
sign-in, without approval. Adding or removing an e-mail takes effect when the app restarts, which
is how a changed environment variable reaches a container anyway; from then on, a removed e-mail
loses the rights at its next request. `users.is_platform_admin` only records the last known state.

Each row is a function in `app/permissions.ts`, tested in `app/permissions.test.ts`; controllers
call it before acting and answer 403 otherwise. `app/permissions.matrix.test.ts` then plays every
implemented row through the real router for eight actors (admin, moderator, responsible of C,
responsible of another collectif, member of C, validated user, pending user, visitor) and checks the effect happened or not:
each verb of a row ("create, edit, delete"), and each "if …" branch of the responsible and
member and validated-user columns, is a separate case. A new row, verb or branch needs a new matrix entry.

"Import a file into a location" arrives with the rest of V0.10 and is not implemented yet. Import
and export of a collectif are for its responsibles for now; members may come later (ADR 0027).

Visibility ([ADR 0021](../../adr/0021-inventory-within-collectifs/)), from V0.7: an item is seen
only by the people who keep it, until sharing arrives in V1.1. "A person of C" is a responsible of
C, and from V0.8 a member too; a user who belongs to several collectifs gets the union of their
rows. Every listing (dashboard, search, collectif page, person page, history, export) filters with
the same rule as `canSeeItem`, in SQL; a page for an item or a person one may not see answers 404,
not 403, so that its existence does not leak. `itemScopeOf(actor)` gives the listings the same
rule, and `app/data/items.visibility.test.ts` checks both sides agree on every branch. Admins and
moderators see everything ([ADR 0025](../../adr/0025-staff-see-every-inventory/)).

Everything is denied unless a row below allows it. Pending, rejected, disabled and deleted users
can only see their status page and sign out.

| Action                                                    | Platform admin                   | Moderator                           | Responsible of C                                      | Member of C                                           | Validated user               |
|-----------------------------------------------------------|----------------------------------|-------------------------------------|-------------------------------------------------------|-------------------------------------------------------|------------------------------|
| Approve or reject an account                              | yes                              | yes                                 | no                                                    | no                                                    | no                           |
| Add, rename, reorder, delete an unused category           | yes                              | yes                                 | no                                                    | no                                                    | no                           |
| Disable an account                                        | yes                              | yes, except an admin or a moderator | no                                                    | no                                                    | no                           |
| Re-enable a disabled account                              | yes                              | yes, except a moderator             | no                                                    | no                                                    | no                           |
| Name or remove a moderator                                | yes                              | no                                  | no                                                    | no                                                    | no                           |
| Edit own profile (name, phone)                            | yes                              | yes                                 | yes                                                   | yes                                                   | yes                          |
| Request a new collectif                                   | yes                              | yes                                 | yes                                                   | yes                                                   | yes                          |
| Approve or reject a collectif                             | yes                              | yes                                 | no                                                    | no                                                    | no                           |
| Ask to join C                                             | yes                              | yes                                 | —                                                     | —                                                     | yes                          |
| Request to become responsible of C                        | —                                | yes                                 | —                                                     | no (asks C's responsibles)                            | if not a person of C         |
| Approve, reject or remove a responsible of C              | yes                              | yes                                 | no                                                    | no                                                    | no                           |
| Accept, reject or remove a member of C                    | no                               | no                                  | yes                                                   | no                                                    | no                           |
| Make a member of C responsible, remove a responsible of C | yes                              | yes                                 | yes                                                   | no                                                    | no                           |
| Leave C                                                   | —                                | —                                   | yes, unless the last responsible                      | yes                                                   | —                            |
| Edit C's profile                                          | yes                              | no                                  | yes                                                   | no                                                    | no                           |
| Create, edit, delete C's locations                        | yes                              | no                                  | yes                                                   | no                                                    | no                           |
| Create, edit, delete own personal locations               | yes                              | yes                                 | yes                                                   | yes                                                   | yes                          |
| Add an item to a location                                 | yes                              | if own location                     | if C's location                                       | if C's location or own location                       | if own location              |
| Edit, move, archive an item                               | yes                              | if owner, or in own location        | if in C's location or owned by C                      | if owned by C, or owner, or in own location           | if owner, or in own location |
| Move an item to a location                                | yes                              | if own location                     | if C's location                                       | if C's location or own location                       | if own location              |
| Edit, move or archive an archived item                    | no                               | no                                  | no                                                    | no                                                    | no                           |
| Give or change an item's reference                        | yes                              | if owner                            | if owned by C, or owner                               | if owned by C, or owner                               | if owner                     |
| Archive an abusive item (owner e-mailed)                  | yes                              | yes                                 | no                                                    | no                                                    | no                           |
| Delete an item (final)                                    | yes                              | yes                                 | if owned by C, or owner                               | if owner                                              | if owner                     |
| Ask to delete an item of C                                | no                               | no                                  | no                                                    | yes                                                   | no                           |
| Accept or reject a request to delete an item of C         | no                               | no                                  | yes                                                   | no                                                    | no                           |
| See the collectifs directory (name, city, text)           | yes                              | yes                                 | yes                                                   | yes                                                   | yes                          |
| See C's equipment, locations and people                   | yes                              | yes                                 | yes                                                   | yes                                                   | no                           |
| See an item, its owner, the city of its location          | yes                              | yes                                 | if owned by C or by a person of C, or in C's location | if owned by C or by a person of C, or in C's location | if owner, or in own location |
| See a person's page and phone                             | yes                              | yes                                 | if the person belongs to C                            | if the person belongs to C                            | if it is their own           |
| See a location (name, city)                               | yes                              | yes                                 | if C's location, or it stores an item seen            | if C's location, or it stores an item seen            | if own, or stores one seen   |
| See a location's full address                             | yes                              | if own location                     | if C's location                                       | if C's location or own location                       | if own location              |
| Import a file into a location                             | any collectif's location, or own | if own location                     | if C's location or own location                       | if own location                                       | if own location              |
| Export an owner's equipment (CSV)                         | any collectif's, or own          | own only                            | C's, or own                                           | own only                                              | own only                     |

Nobody but an admin gives themselves a collectif: a moderator never approves their own request to
become responsible or their own collectif, never names themselves as a replacement, and never
promotes themselves in a collectif they belong to (`canMakeResponsibleByPlatform`,
`canApproveCollectif`, `canPromoteToResponsible`; security review of V0.8).

When an admin or a moderator deletes an item that is neither theirs nor their collectif's
(`deletesAsPlatform`), they give a reason, e-mailed to the owner (each responsible apart for a
collectif) and stored nowhere, as for the moderation archive.

A collectif always keeps one active responsible **with an active account**: a disabled responsible
does not count, and disabling the only one tells the staff which collectifs need another. Decisions
on a membership row carry the state they expect in their `UPDATE`, so two at once cannot both apply.

A collectif always keeps one active responsible: removing the role from the last one, or the last
one leaving, is refused until another member is named (checked in the transaction, rows locked
`FOR UPDATE`). A removed responsible stays a member of the collectif (US-0.8.6).

An admin can never disable their own account, nor the account of another admin listed in
`PLATFORM_ADMIN_EMAILS` (one admin must not lock the others out; remove them from the list instead). A location's notes follow the full-address rule
(they often hold access codes): `redactLocation()` blanks both before rendering.

Rules from ADR 0009: the owner of an item stored in a collectif's location may edit it without
being responsible of that collectif; to put an item in a location, you must manage that location
or, from V0.8, belong to its collectif (US-0.8.5). A member of C keeps C's own equipment; the items
others deposited in C's locations, C's locations, its members and its profile stay with its
responsibles.

An item's reference (US-0.10.3) is unique in its owner's namespace, so only the owner sets it: the
person, a person of the owning collectif, or an admin. A responsible who deposits or edits someone
else's item leaves it as it is; the refusal comes before the uniqueness check, so it never tells
which references that person uses.

What "edit, move, archive" covers: whoever may edit an item may change **every** property of it
(name, category, quantity, condition, value, description…), archive it, and move it to **any**
location they manage. So a responsible of C may change the condition of a person's item deposited
in C's location, or move it to another of C's locations or to their own home; the person stays the
owner, and still sees and edits the item. Only the owner never changes.
