---
title: Data model
description: Entities, key fields and database constraints.
sidebar:
  order: 2
---

Ownership and storage are separate (ADR 0009): an item has one owner, a collectif **or** a user,
and always sits in one location, itself owned by a collectif **or** a user.

```mermaid
erDiagram
  users ||--o{ responsibles : "is"
  collectifs ||--o{ responsibles : "has"
  collectifs ||--o{ locations : "owns"
  users ||--o{ locations : "owns"
  locations ||--o{ items : "stores"
  collectifs ||--o{ items : "owns"
  users ||--o{ items : "owns"
  categories ||--o{ items : "classifies"
```

| Table            | Key fields                                                                                                                                                                                                             | Constraints                                                                                                                                                                                       |
|------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `users`          | id, email, name, phone (optional), status, is_platform_admin, rejection_reason, created_at, updated_at, deleted_at                                                                                                     | email unique and lower-case; status ∈ pending, active, rejected, disabled, deleted                                                                                                                |
| `collectifs`     | id, name, slug, description, contact_phone (optional), status, requested_by, validated_by, validated_at, rejection_reason                                                                                              | slug unique among pending and active collectifs (a rejected request frees it); status ∈ pending, active, rejected                                                                                 |
| `responsibles`   | user_id, collectif_id, status, requested_at, validated_by, validated_at                                                                                                                                                | (user_id, collectif_id) primary key; status ∈ pending, active, rejected, removed; an active collectif keeps ≥ 1 active responsible (checked in the removal transaction, rows locked `FOR UPDATE`) |
| `locations`      | id, name, city, address, notes, collectif_id, user_id                                                                                                                                                                  | exactly one of collectif_id / user_id                                                                                                                                                             |
| `categories`     | id (text key), name (French), parent_id, position                                                                                                                                                                      | fixed list seeded by migration 0007: sound, lighting, video, structure, scenery, power, cabling, other                                                                                            |
| `items`          | id, name, description, category_id, brand, model, serial_number, quantity, condition, estimated_value, location_id, owner_collectif_id, owner_user_id, archived_at, archive_reason, created_by, created_at, updated_at | quantity ≥ 1; location_id required, `ON DELETE RESTRICT`; exactly one owner; condition ∈ new, good, worn, repair, broken; archive_reason set iff archived_at                                      |
| `sessions`       | id, user_id, data (jsonb), expires_at, created_at                                                                                                                                                                      | user_id → users, deleted with the user (ADR 0017)                                                                                                                                                 |
| `sign_in_tokens` | token_hash, user_id, expires_at, used_at, created_at                                                                                                                                                                   | only the SHA-256 of the token is stored; 15 min, single use                                                                                                                                       |
| `audit_log`      | id, actor_id, action, entity, entity_id, payload (jsonb), at                                                                                                                                                           | append only; IDs only, no personal data (ADR 0010)                                                                                                                                                |

`audit_log` actions so far: `account.approved|rejected|disabled`, `collectif.approved|rejected|updated`,
`responsible.approved|rejected|removed`, `location.created|updated|deleted`,
`item.created|updated|moved|archived`. Payloads hold IDs, enum values and field names only;
`readHistory()` resolves names at display time.

Added later:

| Version | Change                                                                              |
|---------|-------------------------------------------------------------------------------------|
| V0.7    | `items.photo_key` (MinIO object key)                                                |
| V0.8    | `items.ref`, unique per owner, for re-import without duplicates; `import_templates` |
| V1.1    | visibility tables (defaults per collectif, circles, per-item overrides)             |

"Exactly one" rules are written as `CHECK (num_nonnulls(a, b) = 1)` in the migration, not only in
code.
