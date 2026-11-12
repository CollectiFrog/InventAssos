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
  users ||--o{ collectif_members : "belongs"
  collectifs ||--o{ collectif_members : "has"
  collectifs ||--o{ locations : "owns"
  users ||--o{ locations : "owns"
  locations ||--o{ items : "stores"
  collectifs ||--o{ items : "owns"
  users ||--o{ items : "owns"
  categories ||--o{ items : "classifies"
```

| Table            | Key fields                                                                                                                                                                                                             | Constraints                                                                                                                                                                                                   |
|------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `users`          | id, email, name, phone (optional), status, is_platform_admin, role, rejection_reason, created_at, updated_at, deleted_at                                                                                               | email unique and lower-case; status ∈ pending, active, rejected, disabled, deleted; role ∈ member, moderator (V0.8; admins come from `PLATFORM_ADMIN_EMAILS` only)                                         |
| `collectifs`     | id, name, slug, city, description, contact_phone (optional), status, requested_by, validated_by, validated_at, rejection_reason                                                                                        | slug unique among pending and active collectifs (a rejected request frees it); status ∈ pending, active, rejected                                                                                             |
| `collectif_members` | user_id, collectif_id, role, status, requested_at, validated_by, validated_at                                                                                                                                          | (user_id, collectif_id) primary key; role ∈ member, responsible; status ∈ pending, active, rejected, removed; an active collectif keeps ≥ 1 active responsible (checked in the removal transaction, rows locked `FOR UPDATE`)|
| `locations`      | id, name, city, address, notes, collectif_id, user_id                                                                                                                                                                  | exactly one of collectif_id / user_id                                                                                                                                                                         |
| `categories`     | id (text key), name (French), parent_id, position                                                                                                                                                                      | seeded by migration 0007 (sound, lighting, video, structure, scenery, power, cabling, other); from V0.7 managed by admins; `name` unique; a category used by an item cannot be deleted (move its items first) |
| `items`          | id, name, description, category_id, brand, model, serial_number, quantity, condition, estimated_value, location_id, owner_collectif_id, owner_user_id, archived_at, archive_reason, created_by, created_at, updated_at | quantity ≥ 1; location_id required, `ON DELETE RESTRICT`; exactly one owner; condition ∈ new, good, worn, repair, broken; archive_reason ∈ sold, lost, broken, other, moderated, set iff archived_at          |
| `sessions`       | id, user_id, data (jsonb), expires_at, created_at                                                                                                                                                                      | signed-in sessions only (visitors' stay in the cookie); user_id → users, deleted with the user; expired rows purged hourly (ADR 0017)                                                                         |
| `sign_in_tokens` | token_hash, user_id, expires_at, used_at, created_at                                                                                                                                                                   | only the SHA-256 of the token is stored; 15 min, single use                                                                                                                                                   |
| `rate_limits`    | key_hash, hits, reset_at                                                                                                                                                                                               | key_hash is a SHA-256 of the limited key (no address stored); purged hourly once reset_at passed (ADR 0018)                                                                                                   |
| `audit_log`      | id, actor_id, action, entity, entity_id, payload (jsonb), at                                                                                                                                                           | append only; IDs only, no personal data (ADR 0010)                                                                                                                                                            |

`audit_log` actions so far: `account.approved|rejected|disabled|enabled`,
`user.moderator_named|moderator_removed`, `collectif.approved|rejected|updated`,
`member.requested|approved|rejected|removed|left`, `responsible.named`,
`responsible.approved|rejected|removed`, `location.created|updated|deleted`,
`item.created|updated|moved|archived|contacted`. Payloads hold IDs, enum values and field names
only; `readHistory()` resolves names at display time. The item page shows an allow-list
(`itemHistoryActions`): `item.contacted` stays in the log for admins and is never displayed.

Added later:

| Version | Change                                                                                                                                         |
|---------|------------------------------------------------------------------------------------------------------------------------------------------------|
| V0.9    | `items.photo_key` (MinIO object key)                                                                                                           |
| V0.10   | `items.ref`, unique per owner, for re-import without duplicates; `import_templates`                                                            |
| V1.1    | sharing tables (defaults per collectif, circles, per-item overrides); until then visibility derives from membership (ADR 0021)                 |

"Exactly one" rules are written as `CHECK (num_nonnulls(a, b) = 1)` in the migration, not only in
code.
