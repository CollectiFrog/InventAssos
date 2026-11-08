---
title: User stories
description: Use cases and user stories with acceptance criteria, per version.
sidebar:
  order: 2
---

Each story reads "as a…, I want…, so that…" and lists its acceptance criteria. An issue is opened
per story when its version is planned; the issue links back here.

## Use cases

| ID   | Use case                                       | Main actor                  | Version |
|------|------------------------------------------------|-----------------------------|---------|
| UC01 | Deploy a new version                           | Maintainer                  | V0.1    |
| UC02 | Sign up                                        | Visitor                     | V0.2    |
| UC03 | Sign in with an e-mail link                    | User                        | V0.2    |
| UC04 | Approve or reject an account                   | Admin                       | V0.2    |
| UC05 | Manage own profile (name, optional phone)      | Validated user              | V0.2    |
| UC06 | Disable an account                             | Admin                       | V0.2    |
| UC07 | Request a new collectif                        | Validated user              | V0.3    |
| UC08 | Request to become responsible of a collectif   | Validated user              | V0.3    |
| UC09 | Approve or reject a collectif or a responsible | Admin                       | V0.3    |
| UC10 | Edit a collectif's profile                     | Responsible                 | V0.3    |
| UC11 | Remove a responsible                           | Admin                       | V0.3    |
| UC12 | Manage a collectif's locations                 | Responsible                 | V0.4    |
| UC13 | Manage own personal locations                  | Validated user              | V0.4    |
| UC14 | Add an item                                    | Validated user, responsible | V0.5    |
| UC15 | Edit or move an item                           | Owner, location manager     | V0.5    |
| UC16 | Archive an item                                | Owner, location manager     | V0.5    |
| UC17 | See an item's history                          | Validated user              | V0.5    |
| UC18 | Browse and search the inventory                | Validated user              | V0.6    |
| UC19 | See an item and contact its owner              | Validated user              | V0.6    |
| UC20 | Add or change an item's photo                  | Owner, location manager     | V0.7    |
| UC21 | Import a CSV or Excel inventory                | Responsible, validated user | V0.8    |
| UC22 | Export an inventory                            | Responsible, validated user | V0.8    |
| UC23 | Export own data or delete own account          | Validated user              | V1.0    |
| UC24 | Purge data 2 to 3 months after deletion        | System                      | V1.0    |

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
    - A notice says the phone is visible to validated users.
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

- **US-0.6.1 Browse.** As a validated user, I want to browse the whole inventory in a paginated
  list, so that I discover available equipment.
- **US-0.6.2 Search and filter.** As a validated user, I want text search (name, brand, model,
  description) and filters (category, collectif, city), so that I find an item fast.
- **US-0.6.3 Item page and contact.** As a validated user, I want an item page with its owner, the
  city of its location and a contact phone, so that I can arrange things with the owner.
    - Without a phone, the page says so (fallback contact: open point).
- **US-0.6.4 Collectif and person pages.** As a validated user, I want to see all equipment of a
  collectif or a person, so that I know what they can lend.

## V0.7 — Photos

- **US-0.7.1 Item photo.** As the owner or the manager of its location, I want to add or replace an
  item's photo, also from my phone, so that it is recognisable.
    - JPEG, PNG, WebP; size limit; resized; metadata (GPS included) stripped; stored in MinIO;
      deleted with the item.

## V0.8 — Import / export

- **US-0.8.1 Import.** As a responsible, I want to import a CSV or Excel file into my collectif's
  location, so that I do not retype the existing inventory.
    - I map file columns to fields; the mapping is saved for the collectif.
- **US-0.8.2 Preview.** As a responsible, I want to see valid, invalid and duplicate rows before
  importing, so that I can fix my file.
    - Nothing is written until I confirm; the import is all or nothing.
- **US-0.8.3 Re-import without duplicates.** As a responsible, I want an already imported item
  updated through its reference, so that I can re-import my file.
    - Adds `items.ref`, unique per owner.
- **US-0.8.4 Export.** As a responsible or validated user, I want to export the equipment I manage
  as CSV or Excel, in the import format, so that I can work in a spreadsheet.
- **US-0.8.5 Import for myself.** As a validated user, I want to import into my personal
  locations, so that I list my own equipment at once.

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

| Story    | Question                                                   | Proposal                                                                     |
|----------|------------------------------------------------------------|------------------------------------------------------------------------------|
| US-1.0.4 | What happens to a leaving person's items?                  | items stored at a collectif go to the collectif; others archived then purged |
| US-0.6.3 | Contact when there is no phone?                            | a form that e-mails the owner without revealing their address                |
| US-0.2.4 | Can a rejected account apply again?                        | yes                                                                          |
| US-0.2.2 | Link and session duration?                                 | link 15 min, single use; session 30 days                                     |
| US-0.5.5 | Archive only, or also hard delete?                         | archive only in V0.x                                                         |
| US-0.8.1 | One file per location, or a location column?               | optional location column; otherwise the chosen location                      |
| —        | Categories fixed by the admin, or created by responsibles? | fixed list managed by the admin                                              |
