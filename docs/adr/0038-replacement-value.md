---
title: "0038: An item's value is its price new"
description: « Valeur estimée » becomes « Valeur à neuf »; the column is renamed and the numbers kept.
---

| Status   | Date       | Deciders   |
|----------|------------|------------|
| Accepted | 2026-11-18 | @tritriper |

## Context

Items had an optional « Valeur estimée (€) » (`items.estimated_value`). In the field, a tester could
not tell what to enter: they know what the item cost new, not what it is worth today, and asked
for « valeur neuf & ancienneté ». Production only runs a beta test, so the data may be migrated
freely.

## Decision

- **The field is « Valeur à neuf (€) »**: the price of the item new, even if it has been used.
  The column becomes `items.replacement_value` (migration 0020) and the form field
  `replacementValue`; the numbers entered so far are kept.
- Imports and exports name the column « Valeur à neuf (€) »; « Valeur estimée » and the other
  former titles are still recognised. Saved column mappings are migrated; an import in progress
  during the deploy starts again.
- History lines logged before the change keep the former column's name, labelled « valeur
  estimée »: the audit log is never rewritten.
- No age or purchase date for now; an estimated value may come back later, computed or entered.

## Alternatives

| Option                                   | Pros                        | Cons                                     | Why not                               |
|------------------------------------------|-----------------------------|------------------------------------------|---------------------------------------|
| Keep « Valeur estimée », add « à neuf »  | both figures                | a second money field nobody fills        | the maintainer chose one field        |
| Add a purchase year now                  | an age for an estimate      | one more field before it is needed       | later, if an estimate comes back      |
| Rename the label only                    | no migration                | the code says one thing, the screen another | beta data: migrate while it is cheap |

## Consequences

- Values entered as an estimate now read as a price new; testers are told in the release notes.
