---
title: "0026: Import and export in CSV, previewed from a temporary table"
description: No spreadsheet dependency for now; uploaded rows wait in PostgreSQL between preview and confirmation.
---

| Status   | Date       | Deciders   |
|----------|------------|------------|
| Accepted | 2026-11-12 | @tritriper |

## Context

V0.10 lets a collectif import its existing inventory and export it back (US-0.10.1 to US-0.10.5).
The stories say « CSV or Excel ». The interface has no client JavaScript (ADR 0015), so mapping
the columns, previewing and confirming are separate pages, and the file must survive between
them. Object storage and the database hosting are about to be re-architected (backups, photos),
so nothing new should lean on a file store.

## Decision

- **CSV only for now.** Excel and LibreOffice open and save CSV; `.xlsx` waits for a later
  decision on a spreadsheet library. `app/csv.ts` reads and writes it without any dependency:
  separator `;` or `,` detected, quoted fields, UTF-8 (with or without BOM) and Windows-1252 as
  spreadsheets on Windows still write it. Exports use `;`, a BOM and CRLF, which Excel in French
  opens directly, and are in the format the import reads.
- **Rows wait in PostgreSQL.** An upload is parsed at once and its rows are kept in a temporary
  table for their author, at most one hour, then purged by the hourly task (ADR 0017's). Limits:
  2 MB and 2,000 rows per file. Nothing reaches the inventory before the confirmation, which
  writes every row in one transaction or none (US-0.10.2).
- **The mapping is guessed, then the user's.** Columns are matched from their headers and each
  category value from what the collectif chose before, the category names and a small vocabulary;
  everything can be changed before validating, and what is unknown falls back to « Autre ». The
  mapping is saved per owner (US-0.10.1).
- **Duplicates go by reference** (US-0.10.3): a reference twice in a file makes the row invalid;
  a known reference updates the item; a row without reference creates one, with a warning when
  an item of the same name already sits in the location.
- **Responsibles import for their collectif**, anyone for their own locations (US-0.10.5);
  members may be allowed later.
- **Exports never run in a spreadsheet.** A cell starting with `=`, `+`, `-`, `@`, a tab or a
  carriage return is prefixed with an apostrophe, so that an item name cannot become a formula
  (CSV injection); the import strips that apostrophe back. An export holds only what its author
  may see (ADR 0021).

## Alternatives

| Option                                 | Pros                          | Cons                                                    | Why not                                  |
|----------------------------------------|-------------------------------|---------------------------------------------------------|------------------------------------------|
| `read-excel-file` + `write-excel-file` | small, maintained             | two dependencies to follow for a format CSV covers      | later, if collectifs ask for `.xlsx`     |
| `exceljs`                              | complete                      | 22 MB, nine dependencies, no release for a long time    | too heavy for reading plain sheets       |
| `xlsx` from npm                        | the best known                | the npm version is outdated, with known vulnerabilities | not safe to parse uploads with           |
| Upload the file again at each step     | nothing kept on the server    | select the same file twice, painful on a phone          | worse journey for the same guarantees    |
| Keep the file in object storage        | large files                   | depends on a store being re-architected                 | not needed under 2 MB                    |

## Consequences

- No new dependency; `app/csv.ts` is ours to test, including hostile files.
- A new table to purge, and one more reason to keep the hourly task healthy.
- An `.xlsx` user saves as CSV first; the import page says how.
- Adding `.xlsx` later only adds a reader in front of the same rows.
