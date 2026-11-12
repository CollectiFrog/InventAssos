---
title: "0027: Import and export rules"
description: Who exports, how a file finds the items it updates, and what an import may change.
---

| Status   | Date       | Deciders   |
|----------|------------|------------|
| Accepted | 2026-11-12 | @tritriper |

Complements [ADR 0026](../0026-csv-import-export/), which chose CSV and the preview table.

## Context

A design study of V0.10 left decisions that ADR 0026 does not settle: who may take a collectif's
whole inventory out, how an export edited in a spreadsheet finds its items again, and what a
re-import may change. They were taken with the maintainer on 2026-11-12.

## Decision

- **Who exports.** A collectif's equipment: its responsibles and the admins. Members and
  moderators export only what they own themselves; members may be allowed later, by changing
  `canExportInventoryOf` only. Everyone exports their own equipment.
- **Who imports.** Into a collectif's locations: its responsibles (and the admins, who manage every
  collectif's locations). Into one's own locations: anyone validated. Members may come later.
- **Identifiant.** Exports carry each item's internal ID in an « Identifiant » column. On import, a
  row with an Identifiant updates that item of the same owner (and may give it a reference); an
  unknown one makes the row invalid. Without it, exporting, editing and importing back would
  create every item without a reference a second time.
- **References** are unique per owner and only the owner sets them (the person, a person of the
  owning collectif, an admin): see `canSetItemRef`.
- **Blank cells keep.** On an update, only mapped, non-blank cells change the item. An import
  never clears a field; that is done in the item form.
- **Archived items.** A row whose reference is an archived item's is not imported by default; the
  preview says the item is archived, and the person may choose to add the row as a new item (the
  reference stays with the archived one).
- **All or nothing.** The import is confirmed only when no row is invalid; the person fixes the
  file and sends it again.
- **The mapping is saved when validated**, before the confirmation, so that a corrected file lands
  on the preview with the same choices.

## Alternatives

| Option                                   | Why not                                                       |
|------------------------------------------|---------------------------------------------------------------|
| Members export their collectif           | a whole inventory out in one click; later, if collectifs ask |
| References only, no Identifiant          | a round trip duplicates every item without a reference        |
| A blank cell clears the field            | a spreadsheet that drops a column would erase data            |
| Rows with an archived reference invalid  | blocks master lists that keep sold equipment                  |
| Import the valid rows, skip the others   | a partial import is hard to finish without duplicates         |

## Consequences

- The export file is also the import's best input: our own header maps every column.
- The confirmation recomputes the plan in its transaction, so the preview and the result agree.
