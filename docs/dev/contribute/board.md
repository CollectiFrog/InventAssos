---
title: Work in progress
description: The kanban board and how cards move.
sidebar:
  order: 3
---

Work in progress is tracked on a **GitHub Projects** board:
<!-- TEMPLATE: replace with the board URL --> `https://github.com/users/OWNER/projects/N`.

Each card is an issue or a pull request, so the board never needs manual copying.

| Column      | A card is here when                 | Moved by                        |
|-------------|-------------------------------------|---------------------------------|
| Backlog     | an issue is opened                  | auto-add workflow               |
| Ready       | it is specified and prioritised     | maintainer                      |
| In progress | someone works on it (branch exists) | assignee                        |
| In review   | its PR is open                      | linked PR                       |
| Done        | its PR is merged into `dev`         | built-in "item closed" workflow |

Link a PR to its issue with `Closes #N` in the description: merging closes the issue and moves the card.

## One-time setup (per project)

1. GitHub → your profile → **Projects** → **New project** → *Board*.
2. Rename the `Status` options to the columns above.
3. Project → **Workflows**: enable *Auto-add to project* (filter `repo:OWNER/REPO is:issue,pr`),
   *Item closed* → Done, *Pull request merged* → Done.
4. Repository → **Projects** tab → link the project. Put its URL on this page.
