---
title: Roadmap
description: Versions from V0.1 to V1.0 and future features.
sidebar:
  order: 1
---

Versions 0.x build the core in small steps. **V1.0** is the first official version: it ships only
once GDPR, the legal framework and data storage are in order ([GDPR checklist](../gdpr-checklist/)).
Everything after is a future feature.

| Version  | Content                                                                                                                    | Done when…                                                              |
|----------|----------------------------------------------------------------------------------------------------------------------------|-------------------------------------------------------------------------|
| V0.1     | Foundations: Remix 3 + PostgreSQL skeleton, migrations, CI, Docker image, deployment                                       | an empty page runs on the cluster, deployed from a tag                  |
| V0.2     | Accounts: sign-up, e-mail sign-in link, pending page, admin approval queue, first admin                                    | an account is created, approved by the admin and signs in               |
| V0.3     | Collectifs: request a collectif, request to become responsible, admin approval                                             | an approved collectif has its responsible                               |
| V0.4     | Locations: collectif and personal locations, city-only visibility                                                          | a responsible and a person each have their locations                    |
| V0.5     | Items: owner, location, quantity, category, contact phone; audit log                                                       | an item is created, edited, moved, and its history shows it             |
| V0.6     | Browse: list, search and filters (category, collectif, city) over the whole inventory                                      | you find another collectif's item and know whom to call                 |
| V0.6.1   | Security fixes from the V0.6 review                                                                                        | the review's findings are closed                                        |
| V0.6.2   | Containerised development environment: the app runs in Compose next to PostgreSQL and Mailpit, plus a Dev Container        | a contributor runs and tests the app with only Docker installed         |
| V0.6.3   | Categories managed in the app by admins: add, rename, reorder, delete when unused (#69)                                    | an admin adds a category and it appears in the add form and the filters |
| V0.7     | Interface: one responsive UI, four-entry navigation, dashboard, empty states, accessibility ([UI](../../architecture/ui/)) | the five key journeys work on a phone without help                      |
| V0.8     | Roles: platform moderators, collectif members approved by responsibles                                                     | a responsible accepts a member who then adds the collectif's equipment  |
| V0.9     | Photos: one photo per item, stored in MinIO                                                                                | item pages show their photo                                             |
| V0.10    | Import / export: CSV and Excel, column mapping, preview, same format both ways                                             | a collectif's existing inventory is imported without duplicates         |
| **V1.0** | **Official version**: GDPR, legal pages, retention, backups                                                                | the whole [GDPR checklist](../gdpr-checklist/) is ticked                |
| V1.1     | Fine-grained visibility: per-collectif defaults, circles of partners, per-item overrides                                   | future feature                                                          |
| V1.2     | QR code per item, pointing to a short URL of its page (`/o/<id>`)                                                          | future feature                                                          |
| V1.3     | Availability                                                                                                               | to define after first use                                               |
| V1.4     | Booking                                                                                                                    | to define after first use                                               |

Accounts and collectifs are approved centrally by admins, and from V0.8 by moderators too;
from V0.8, responsibles approve their collectif's members ([ADR 0020](../../adr/0020-platform-and-collectif-roles/)).
Details per version:
[User stories](../user-stories/).
