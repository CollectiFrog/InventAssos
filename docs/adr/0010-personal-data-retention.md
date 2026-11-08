---
title: "0010: Personal data retention and an ID-only audit log"
description: Purge 2 to 3 months after account deletion; the audit log never holds personal data.
---

| Status   | Date       | Deciders   |
|----------|------------|------------|
| Accepted | 2026-11-06 | @tritriper |

## Context

The platform stores personal data of volunteers (name, e-mail, optional phone, personal storage
addresses). GDPR requires a retention limit. The audit log must stay useful after people leave.

## Decision

- Personal data of a deleted account is purged **2 to 3 months after deletion**, backups included
  (exact duration fixed before V1.0).
- The audit log stores **IDs only**: actor, action, entity, entity ID, non-personal payload. Once
  the account is purged, its ID points to nothing and the log no longer identifies anyone.
- Only the **city** of a location is visible to other users; the full address stays with its owner
  and the platform admin.
- The phone number is optional and shown to validated users, which is stated at sign-up.

## Alternatives

| Option                          | Why not                                             |
|---------------------------------|-----------------------------------------------------|
| Names copied into the audit log | log would keep personal data forever                |
| Immediate hard delete           | no grace period for mistakes or abuse investigation |

## Consequences

- A scheduled purge job is needed (V1.0, US-1.0.5).
- Code reviews check that no personal field enters the audit payload.
