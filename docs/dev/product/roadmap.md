---
title: Roadmap
description: Versions from V0.1 to V1.0 and future features.
sidebar:
  order: 1
---

Versions 0.x build the core in small steps. **V1.0** is the first official version: it ships only
once GDPR, the legal framework and data storage are in order ([GDPR checklist](../gdpr-checklist/)).
Everything after is a future feature.

| Version  | Content                                                                                  | Done when…                                                      |
|----------|------------------------------------------------------------------------------------------|-----------------------------------------------------------------|
| V0.1     | Foundations: Remix 3 + PostgreSQL skeleton, migrations, CI, Docker image, deployment     | an empty page runs on the cluster, deployed from a tag          |
| V0.2     | Accounts: sign-up, e-mail sign-in link, pending page, admin approval queue, first admin  | an account is created, approved by the admin and signs in       |
| V0.3     | Collectifs: request a collectif, request to become responsible, admin approval           | an approved collectif has its responsible                       |
| V0.4     | Locations: collectif and personal locations, city-only visibility                        | a responsible and a person each have their locations            |
| V0.5     | Items: owner, location, quantity, category, contact phone; audit log                     | an item is created, edited, moved, and its history shows it     |
| V0.6     | Browse: list, search and filters (category, collectif, city) over the whole inventory    | you find another collectif's item and know whom to call         |
| V0.7     | Photos: one photo per item, stored in MinIO                                              | item pages show their photo                                     |
| V0.8     | Import / export: CSV and Excel, column mapping, preview, same format both ways           | a collectif's existing inventory is imported without duplicates |
| **V1.0** | **Official version**: GDPR, legal pages, retention, backups                              | the whole [GDPR checklist](../gdpr-checklist/) is ticked        |
| V1.1     | Fine-grained visibility: per-collectif defaults, circles of partners, per-item overrides | future feature                                                  |
| V1.2     | QR code per item, pointing to a short URL of its page (`/o/<id>`)                        | future feature                                                  |
| V1.3     | Availability                                                                             | to define after first use                                       |
| V1.4     | Booking                                                                                  | to define after first use                                       |

Until V1.0 included, the platform admin approves every request (ADR 0011). Details per version:
[User stories](../user-stories/).
