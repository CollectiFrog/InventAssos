---
title: Permissions
description: Who can do what. Every rule is checked on the server and has a test.
sidebar:
  order: 3
---

**Platform admin** means: the account's e-mail is listed in `PLATFORM_ADMIN_EMAILS`, read on every
request (`context.currentUser.isAdmin`). A listed e-mail becomes an active account at its first
sign-in, without approval; removing it from the list removes the rights at the next request.
`users.is_platform_admin` only records the last known state.

Each row is a function in `app/permissions.ts`, tested in `app/permissions.test.ts`; controllers
call it before acting and answer 403 otherwise, with a router test per protected route.

Everything is denied unless a row below allows it. Pending, rejected, disabled and deleted users
can only see their status page and sign out.

| Action                                           | Platform admin | Responsible of C                 | Validated user               |
|--------------------------------------------------|----------------|----------------------------------|------------------------------|
| Approve or reject an account                     | yes            | no                               | no                           |
| Disable an account                               | yes            | no                               | no                           |
| Edit own profile (name, phone)                   | yes            | yes                              | yes                          |
| Request a new collectif                          | yes            | yes                              | yes                          |
| Approve or reject a collectif                    | yes            | no                               | no                           |
| Request to become responsible of C               | —              | —                                | yes                          |
| Approve, reject or remove a responsible of C     | yes            | no                               | no                           |
| Edit C's profile                                 | yes            | yes                              | no                           |
| Create, edit, delete C's locations               | yes            | yes                              | no                           |
| Create, edit, delete own personal locations      | yes            | yes                              | yes                          |
| Add an item to a location                        | yes            | if C's location                  | if own location              |
| Edit, move, archive an item                      | yes            | if in C's location or owned by C | if owner, or in own location |
| Move an item to a location                       | yes            | if C's location                  | if own location              |
| See an item, its owner, the city of its location | yes            | yes                              | yes                          |
| See a location's full address                    | yes            | if C's location                  | if own location              |
| Import into / export from a location             | yes            | if C's location                  | if own location              |

An admin can never disable their own account.

Rules from ADR 0009: the owner of an item stored in a collectif's location may edit it without
being responsible of that collectif; to put an item in a location, you must manage that location.
