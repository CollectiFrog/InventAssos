---
title: User stories
description: Use cases and user stories with acceptance criteria, per version.
sidebar:
  order: 2
---

Each story reads "as a…, I want…, so that…" and lists its acceptance criteria. An issue is opened
per story when its version is planned; the issue links back here.

## Use cases

| ID   | Use case                                        | Main actor                    | Version |
|------|-------------------------------------------------|-------------------------------|---------|
| UC01 | Deploy a new version                            | Maintainer                    | V0.1    |
| UC02 | Sign up                                         | Visitor                       | V0.2    |
| UC03 | Sign in with an e-mail link                     | User                          | V0.2    |
| UC04 | Approve or reject an account                    | Admin                         | V0.2    |
| UC05 | Manage own profile (name, optional phone)       | Validated user                | V0.2    |
| UC06 | Disable an account                              | Admin                         | V0.2    |
| UC07 | Request a new collectif                         | Validated user                | V0.3    |
| UC08 | Request to become responsible of a collectif    | Validated user                | V0.3    |
| UC09 | Approve or reject a collectif or a responsible  | Admin                         | V0.3    |
| UC10 | Edit a collectif's profile                      | Responsible                   | V0.3    |
| UC11 | Remove a responsible                            | Admin                         | V0.3    |
| UC12 | Manage a collectif's locations                  | Responsible                   | V0.4    |
| UC13 | Manage own personal locations                   | Validated user                | V0.4    |
| UC14 | Add an item                                     | Validated user, responsible   | V0.5    |
| UC15 | Edit or move an item                            | Owner, location manager       | V0.5    |
| UC16 | Archive an item                                 | Owner, location manager       | V0.5    |
| UC17 | See an item's history                           | Validated user                | V0.5    |
| UC18 | Browse and search the inventory                 | Validated user                | V0.6    |
| UC30 | Browse the collectifs directory                 | Validated user                | V0.7    |
| UC19 | See an item and contact its owner               | Validated user                | V0.6    |
| UC20 | Add or change an item's photo                   | Owner, location manager       | V0.11   |
| UC21 | Import a CSV or Excel inventory                 | Responsible, validated user   | V0.10   |
| UC22 | Export an inventory                             | Responsible, validated user   | V0.10   |
| UC23 | Export own data or delete own account           | Validated user                | V1.0    |
| UC24 | Purge data 2 to 3 months after deletion         | System                        | V1.0    |
| UC25 | Find the way on a phone or a computer           | Validated user                | V0.7    |
| UC26 | Name or remove a moderator                      | Admin                         | V0.8    |
| UC27 | Ask to join a collectif                         | Validated user                | V0.8    |
| UC28 | Accept, reject or remove a member               | Responsible                   | V0.8    |
| UC29 | Make a member responsible, remove a responsible | Responsible, admin, moderator | V0.8    |
| UC30 | Leave a collectif                               | Member, responsible           | V0.8    |
| UC31 | Delete an item, or ask to delete it             | Responsible, owner, member    | V0.8    |
| UC32 | Name or remove an admin                         | Admin                         | V0.10.x |
| UC33 | Sign in with a password                         | User                          | V0.10.x |

## V0.1 — Foundations

- **US-0.1.1 Skeleton.** As a maintainer, I want a Remix 3 + PostgreSQL project that starts locally
  with one command, so that any contributor can run the app.
    - A home page answers; an initial migration creates the database.
    - Configuration comes only from environment variables, with `.env.example`.
- **US-0.1.2 Continuous integration.** As a maintainer, I want every PR checked automatically, so
  that `dev` never breaks.
    - `make check` (lint, typecheck, test, build) runs on each PR against a PostgreSQL service; a
      failure blocks the merge.
- **US-0.1.3 Delivery.** As a maintainer, I want a `vX.Y.Z` tag to produce the Docker image on
  GHCR, so that I deploy an identified version.
    - Image tagged `X.Y.Z`; no secret and no media inside it.
- **US-0.1.4 Deployment.** As a maintainer, I want to deploy the image on `inv.collecti-frog.fr` by
  changing its tag in the infra repository, so that a version goes live.
    - The app answers over HTTPS; migrations run at startup; rolling back is documented.

## V0.2 — Accounts

- **US-0.2.1 Sign up.** As a visitor, I want to sign up with my name and e-mail, so that I can ask
  for access.
    - The account is created *pending*; the admin gets an e-mail; a second sign-up with the same
      e-mail is refused.
- **US-0.2.2 Sign in.** As a user, I want to receive a sign-in link by e-mail, so that I sign in
  without a password.
    - Single-use link, short expiry (15 min proposed); the request never reveals whether the e-mail exists.
- **US-0.2.3 Wait for approval.** As a pending user, I want to see that my request is in progress,
  so that I know where I stand.
    - Any other page redirects to the "account under review" page.
- **US-0.2.4 Approve an account.** As an admin, I want to accept or reject pending accounts, so
  that I control access.
    - The person gets an e-mail; a rejection may carry a reason; the action is logged.
- **US-0.2.5 First admin.** As a maintainer, I want the e-mails listed in `PLATFORM_ADMIN_EMAILS`
  to become admin at first sign-in, so that the platform can start.
- **US-0.2.6 Profile.** As a validated user, I want to edit my name and optional phone, so that I
  can be reached.
    - A notice says who sees the phone: validated users in V0.6, from V0.7 the people who share a
      collectif with me (ADR 0021).
- **US-0.2.7 Disable.** As an admin, I want to disable an account, so that I cut access without
  losing data.
    - Its sessions are closed; its items stay visible.
- **US-0.2.8 Sign out.** As a user, I want to sign out, so that my account is safe on a shared device.

## V0.3 — Collectifs

- **US-0.3.1 Request a collectif.** As a validated user, I want to request a new collectif (name,
  description, optional contact phone), so that I can list its equipment.
    - The collectif is *pending*; names are unique; the admin is notified.
- **US-0.3.2 Approve a collectif.** As an admin, I want to accept or reject a collectif, so that I
  prevent duplicates and impersonation.
    - On acceptance the requester becomes responsible; they are e-mailed either way.
- **US-0.3.3 Become responsible.** As a validated user, I want to ask to become responsible of an
  existing collectif, so that I can manage its equipment.
    - The request appears in the admin queue; one open request per person and collectif.
- **US-0.3.4 Approve a responsible.** As an admin, I want to accept or reject a responsible
  request, so that I control who manages each collectif.
- **US-0.3.5 Edit profile.** As a responsible, I want to edit my collectif's description and
  contact phone, so that they stay current.
- **US-0.3.6 Remove a responsible.** As an admin, I want to remove a responsible, so that I handle
  departures.
    - The last responsible of an active collectif cannot be removed without naming another.
- **US-0.3.7 Admin queue.** As an admin, I want one screen listing pending accounts, collectifs and
  responsibles, so that I handle everything in one place.

## V0.4 — Locations

- **US-0.4.1 Collectif locations.** As a responsible, I want to create, edit and delete my
  collectif's locations (name, city, address, notes), so that we know where equipment is stored.
    - A location that still holds items cannot be deleted.
- **US-0.4.2 Personal locations.** As a validated user, I want my own locations, so that I can list
  equipment kept at home.
- **US-0.4.3 Address privacy.** As a validated user, I want only the city of my locations shown to
  others, so that my home address is not exposed.
    - The full address is visible to the location's owner and the admin only, including in exports.

## V0.5 — Items

- **US-0.5.1 Add an item.** As a validated user, I want to add an item to a location I manage, so
  that it is listed.
    - Fields: name, category, quantity (≥ 1), brand, model, serial number, condition, estimated
      value, description. Owner: me, or a collectif I am responsible of.
- **US-0.5.2 A person's item at a collectif.** As a responsible, I want to store in my collectif's
  location an item owned by a person, so that deposits are reflected.
    - The owner must be a validated account; they can then edit their item.
- **US-0.5.3 Edit an item.** As the owner or the manager of its location, I want to edit an item,
  so that the inventory stays right.
- **US-0.5.4 Move an item.** As the owner or the manager of its location, I want to move an item to
  another location I manage, so that its moves are tracked.
- **US-0.5.5 Archive an item.** As the owner or the manager of its location, I want to archive an
  item sold, lost or broken, so that it leaves the inventory but keeps its history.
- **US-0.5.6 History.** As a validated user, I want an item's history (created, edited, moved), so
  that I know what happened to it.
    - The log stores IDs only; names are resolved at display while accounts exist.
- **US-0.5.7 Deny by default.** As a maintainer, I want any unauthorised action refused on the
  server, so that the UI is never the only barrier.
    - Each rule in [Permissions](../../architecture/permissions/) has an automated test.

## V0.6 — Browse

Built as a shared catalogue: every validated user sees every item. From V0.7 the inventory is seen
only within collectifs ([ADR 0021](../../adr/0021-inventory-within-collectifs/), US-0.7.11); the
stories below keep their wording as they shipped.

- **US-0.6.1 Browse.** As a validated user, I want to browse the whole inventory in a paginated
  list, so that I discover available equipment.
- **US-0.6.2 Search and filter.** As a validated user, I want text search (name, brand, model,
  description) and filters (category, collectif, city), so that I find an item fast.
- **US-0.6.3 Item page and contact.** As a validated user, I want an item page with its owner, the
  city of its location and a contact phone, so that I can arrange things with the owner.
    - Without a phone, the page says so (fallback contact: open point).
- **US-0.6.4 Collectif and person pages.** As a validated user, I want to see all equipment of a
  collectif or a person, so that I know what they can lend.
- **US-0.6.5 Re-enable an account** (patch, security review). As an admin, I want to re-enable a
  disabled account, so that a mistaken or temporary disable can be undone without SQL.
    - The person can sign in again; the action is logged. An admin listed in
      `PLATFORM_ADMIN_EMAILS` cannot be disabled from the app.

## V0.6.2 — Development environment

- **US-0.6.6 Docker only.** As a contributor, I want to run the app, its tests and the checks with
  only Docker installed, so that I do not install Node, PostgreSQL or a mail server myself.
    - `compose.yaml` gains an `app` service (Node ≥ 24.3, source mounted, reload on change) next to
      `db` and `mail`; `make dev`, `make test` and `make check` work in it.
    - A Dev Container (`.devcontainer/`) reuses the same Compose file for VS Code and Codespaces.
    - The current way (Node on the host, `make db`) keeps working.

## V0.7 — Interface

The pages, navigation and journeys are described in [UI](../../architecture/ui/); the conventions
in [ADR 0019](../../adr/0019-interface-conventions/). One responsive interface serves phones and
computers.

- **US-0.7.1 Navigation.** As a validated user, I want four entries (Accueil, Rechercher, Mon
  matériel, Collectifs), so that I always know where to go.
    - A tab bar at the bottom of the screen on a phone; on a computer a left rail (720–1099 px)
      then a sidebar with my collectifs and Administration (ADR 0022). A top bar holds the search
      field, "Ajouter du matériel" and the account.
- **US-0.7.2 Dashboard.** As a validated user, I want a home page with search first, my
  collectifs and the equipment recently added to them, so that every task starts from one place.
    - Without any collectif, the dashboard proposes the collectifs directory and "Demander un
      collectif" instead of an empty list.
    - Admins (and moderators from V0.8) see the number of pending requests, linked to the queue.
- **US-0.7.3 What I hold.** As a validated user, I want "Mon matériel" to list the equipment stored
  in my locations right now, so that I know what I am holding and for whom.
    - Three sections by owner: mine, my collectifs' (stored at my place), others' (borrowed: owned by
      someone else, stored at my place). Equipment I own but stored elsewhere is not listed here.
    - Tab Lieux lists my own locations; a collectif's locations are on the collectif's page.
- **US-0.7.4 Create a location while adding.** As a validated user, I want to create a location
  from the add form, so that I am not blocked when I have none.
- **US-0.7.5 Collectif page.** As a person of a collectif, I want its page in tabs (Matériel,
  Lieux, Responsables), with "Ajouter du matériel" first for its responsibles, so that its
  management is grouped.
    - Someone outside the collectif sees its name, city and description only, with "Demander à
      devenir responsable" (and "Demander à rejoindre" from V0.8).
- **US-0.7.6 Item page.** As a person who sees an item, I want the owner and the city at the top of
  its page and Appeler / SMS / Écrire buttons within reach of the thumb, so that reaching whoever
  keeps it takes one tap.
    - From the dashboard to the owner's phone in three taps at most.
- **US-0.7.7 Clear feedback.** As a user, I want a confirmation after every action, an error in
  French under each wrong field and an empty state that proposes the next action, so that I
  never wonder what happened.
    - The add form recalls owner and location before saving.
- **US-0.7.8 Back where I was.** As a user who follows a link while signed out, I want to land on
  that page after signing in, so that I do not lose my way.
- **US-0.7.9 Accessible.** As a user, I want WCAG AA contrast, 44 px touch targets, a visible focus
  and labelled controls, so that the app works in a dark storage room, in the sun and with
  assistive technologies.
    - An automated accessibility check runs in CI on the key pages.
- **US-0.7.10 Manage categories.** As a platform admin, I want to add a category, rename it and
  change the order of the list, so that the categories fit what associations really own without a
  new release (decided in #69).
    - A category has a fixed key and a French name; names are unique.
    - A category still used by items cannot be deleted: its items are first moved to another
      category; an unused one can be deleted.
    - Changes show at once in the add form and the search filters; each change is logged (IDs only).
    - One level for now; the data model keeps `parent_id` so that sub-categories can follow.
- **US-0.7.11 Inventory within collectifs.** As a collectif, I want our equipment seen only by our
  responsibles and members, so that we keep our inventory among ourselves until we choose to share
  it ([ADR 0021](../../adr/0021-inventory-within-collectifs/)).
    - I see an item when it is owned by a collectif I belong to, by me or by a person of one of my
      collectifs, or when it is stored in a location I manage; admins keep today's access.
    - Dashboard, search, filters (collectif filter limited to mine), collectif and person pages,
      history and contact only cover those items; an item or person page I may not see answers 404.
    - A person's page and phone are shown only to people who share a collectif with them.
    - The rule is one function (`canSeeItem`) mirrored in SQL by every listing, with matrix tests
      for a non-member; the user manual and the profile notice say who sees what.
- **US-0.7.12 Collectifs directory.** As a validated user, I want the list of collectifs with their
  name, city and description, so that I find mine and ask to manage or join it.
    - "Mes collectifs" first, then all collectifs, with a search by name or city; no item, location
      or member of a collectif I do not belong to is shown.
- **US-0.7.13 Use the whole screen.** As a user on a computer, I want pages that use the full
  width of my window, so that I see more of my inventory at once and manage it faster (ADR 0022).
    - No page-wide maximum width up to 2000 px; four templates (index, detail, settings, wizard),
      no phone-sized frame on any page.
    - Rechercher and a collectif's equipment are dense tables by default, sortable, with filters
      on the left and active filters removable; `?vue=grille` shows cards.
    - Mon compte is a settings page in sections; deleting the account goes through
      `/compte/supprimer`. Administration sections have their own URLs.
    - Nothing changes below 720 px.

## V0.8 — Roles

Platform roles: admin, moderator, member. Collectif roles: responsible, member
([ADR 0020](../../adr/0020-platform-and-collectif-roles/)).

- **US-0.8.1 Moderators.** As an admin, I want to name and remove moderators among validated
  users, so that I share the approval work.
    - Admins still come only from `PLATFORM_ADMIN_EMAILS`.
- **US-0.8.2 Moderate.** As a moderator, I want to handle the approval queue, disable or re-enable
  an account, archive an abusive item and manage categories (US-0.7.10), so that the platform stays
  clean.
    - A moderator cannot act on an admin or another moderator, nor name moderators.
    - The owner of an item archived by a moderator is e-mailed with the reason.
- **US-0.8.3 Join a collectif.** As a validated user, I want to ask to join a collectif from the
  directory or its page, so that I see and help keep its inventory.
    - Until accepted, I see only its name, city and description (ADR 0021).
    - One open request per person and collectif; its responsibles are e-mailed.
- **US-0.8.4 Accept a member.** As a responsible, I want to accept or reject membership requests
  and remove members, so that I control who manages our equipment.
    - The person is e-mailed either way; the action is logged (IDs only).
- **US-0.8.5 Member rights.** As a member of a collectif, I want to see its inventory, add, edit,
  move and archive its items and see the full address of its locations, so that I keep its
  inventory up to date.
    - Locations, members and the collectif's profile stay with its responsibles.
- **US-0.8.6 Name a responsible.** As a responsible, I want to make a member of my collectif
  responsible, or remove a responsible, so that the collectif runs without waiting for the platform.
    - Admins and moderators can do the same for any collectif, so that a collectif is never left
      without a responsible.
    - A removed responsible stays a member of the collectif.
- **US-0.8.7 Members tab.** As a responsible, I want a Membres tab on my collectif's page with the
  pending requests first, so that nobody waits.
- **US-0.8.8 Leave a collectif.** As a member or a responsible, I want to leave a collectif, so
  that I am no longer listed once I stop helping.
    - The last responsible cannot leave without naming a member as responsible first.
- **US-0.8.9 Delete an item.** As a responsible of its owning collectif, its personal owner, an
  admin or a moderator, I want to delete an item entered by mistake, so that the inventory holds
  only real equipment.
    - Deletion is final: the item and its history are erased; the audit log keeps the IDs only
      ([ADR 0010](../../adr/0010-personal-data-retention/)).
    - Archiving stays for equipment sold, lost or broken, whose history is worth keeping.
- **US-0.8.10 Ask to delete an item.** As a member of a collectif, I want to ask its responsibles
  to delete one of its items, so that a mistake is fixed without giving me final powers.
    - The request shows in the Membres tab next to membership requests; no e-mail is sent.
    - One open request per item; a responsible accepts (the item is deleted) or rejects it.
- **US-0.8.11 Deployment guide.** As the maintainer, I want the instructions to deploy a version on
  Kubernetes (image, environment, secrets, probes, migrations, first admin), so that V0.8 can be
  put in production from the docs alone.

## V0.10 — Import / export

- **US-0.10.1 Import.** As a responsible, I want to import a CSV or Excel file into my collectif's
  location, so that I do not retype the existing inventory.
    - I map file columns to fields; the mapping is saved for the collectif.
- **US-0.10.2 Preview.** As a responsible, I want to see valid, invalid and duplicate rows before
  importing, so that I can fix my file.
    - Nothing is written until I confirm; the import is all or nothing.
- **US-0.10.3 Re-import without duplicates.** As a responsible, I want an already imported item
  updated through its reference, so that I can re-import my file.
    - Adds `items.ref`, unique per owner.
- **US-0.10.4 Export.** As a responsible or validated user, I want to export the equipment I manage
  as CSV or Excel, in the import format, so that I can work in a spreadsheet.
    - A collectif's equipment: its responsibles and admins; everyone exports their own
      ([ADR 0027](../../adr/0027-import-export-rules/)).
    - An export never holds an item its author may not see (ADR 0021).
- **US-0.10.5 Import for myself.** As a validated user, I want to import into my personal
  locations, so that I list my own equipment at once.

## V0.10.x — Field feedback

Remarks gathered from the first weeks of use, shipped together as one patch.

- **US-0.10.6 Sign in from the link at once.** As a user, I want the link from the sign-in e-mail
  to sign me in without another click, so that signing in is quicker.
    - Opening the link signs in and lands on the home page, or on the page asked for (US-0.7.8).
    - The link stays single-use and valid 15 minutes; a used or expired link offers a new one.
- **US-0.10.7 Name admins in the app.** As an admin, I want to name and remove other admins in the
  app, so that sharing the role needs no deployment
  ([ADR 0028](../../adr/0028-admins-named-in-the-app/)).
    - Any admin names an admin or a moderator by the e-mail of a validated account, on
      Administration › Équipe (formerly Modérateurs), and removes them.
    - Admins of `PLATFORM_ADMIN_EMAILS` are shown but never removed nor disabled from the app;
      nobody changes their own role.
    - A named admin has every admin right; a moderator never acts on them. No e-mail is sent.
- **US-0.10.8 Sign in with a password.** As a user, I want to sign in with a password, so that I
  do not wait for an e-mail ([ADR 0029](../../adr/0029-password-sign-in/)).
    - The e-mailed link keeps working; the sign-in page offers both with one e-mail field.
    - A password is created or changed only through an e-mailed link (« Mot de passe oublié ou pas
      encore créé ? », or Mon compte › Mot de passe), valid 30 minutes, single use.
    - At least 12 characters, no other rule; no second factor, staff included.
    - The same answer for an unknown address, a wrong password or no password; 10 tries per address
      per hour.
    - Choosing a password closes the other sessions and e-mails the person.

## V0.11 — Photos

Moved from V0.9: photos wait for the re-architecture of storage and backups (the store, MinIO or
another, is chosen then).

- **US-0.11.1 Item photo.** As the owner or the manager of its location, I want to add or replace an
  item's photo, also from my phone, so that it is recognisable.
    - JPEG, PNG, WebP; size limit; resized; metadata (GPS included) stripped; deleted with the item.

## V1.0 — Compliance

These stories complement the [GDPR checklist](../gdpr-checklist/).

- **US-1.0.1 Information at sign-up.** As a visitor, I want to know before signing up which data is
  collected, why, who sees it and for how long, so that I consent knowingly.
- **US-1.0.2 Legal pages.** As a visitor, I want the legal notice, privacy policy and terms of use
  reachable from every page, so that I know the framework.
- **US-1.0.3 Export my data.** As a validated user, I want to download all my data (profile,
  locations, items), so that I exercise my right of access.
- **US-1.0.4 Delete my account.** As a validated user, I want to delete my account, so that I
  exercise my right to erasure.
    - The account is disabled at once; what happens to its items and locations is an open point.
- **US-1.0.5 Automatic purge.** As the system, I want to purge an account's data 2 to 3 months
  after deletion, backups included, so that the announced retention holds.
    - Only the ID remains in the audit log.
- **US-1.0.6 Backups.** As a maintainer, I want encrypted off-server backups with a tested restore,
  so that collectifs never lose their inventory.

## Open points

| Story     | Question                                         | Proposal                                                                     |
|-----------|--------------------------------------------------|------------------------------------------------------------------------------|
| US-1.0.4  | What happens to a leaving person's items?        | items stored at a collectif go to the collectif; others archived then purged |
| US-0.6.3  | Contact when there is no phone?                  | a form that e-mails the owner without revealing their address                |
| US-0.2.4  | Can a rejected account apply again?              | yes                                                                          |
| US-0.2.2  | Link and session duration?                       | link 15 min, single use; session 30 days                                     |
| US-0.5.5  | Archive only, or also hard delete?               | decided: archive until V0.7; final deletion from V0.8 (US-0.8.9, US-0.8.10)  |
| US-0.10.1 | One file per location, or a location column?     | optional location column; otherwise the chosen location                      |
| US-0.10.1 | CSV and Excel, or CSV first?                     | decided: CSV first ([ADR 0026](../../adr/0026-csv-import-export/))           |
| US-0.10.1 | Who imports for a collectif?                     | decided: its responsibles for now; members maybe later                       |
| US-0.10.2 | What is a duplicate row?                         | decided: by reference; same name only warns (ADR 0026)                       |
| US-0.10.3 | Blank cells, archived items, round trip?         | decided: blank keeps; archived not imported unless forced; Identifiant column (ADR 0027) |
| US-0.8.5  | Can a member delete an item, or only archive it? | decided: a member archives, and asks a responsible to delete (US-0.8.10)     |
| US-0.7.11 | Do admins and moderators see every inventory?    | decided: yes, both ([ADR 0025](../../adr/0025-staff-see-every-inventory/))   |
| US-0.8.3  | Could responsibles approve new accounts alone?   | later, maybe: admins and moderators approve accounts for now                 |
