---
title: Developer documentation
description: Everything needed to build, change and release the project.
---

Published from the `dev` branch: it always describes the latest integrated work,
which may be ahead of the released version described in the user docs.

| Section                                              | For                                       |
|------------------------------------------------------|-------------------------------------------|
| [Setup](contribute/setup/)                           | getting a working dev environment         |
| [Workflow](contribute/workflow/)                     | branches, commits, PRs, conventions       |
| [Work in progress](contribute/board/)                | the kanban board (GitHub Projects)        |
| [Releasing](contribute/releasing/)                   | shipping a version and deploying it       |
| [Architecture](architecture/overview/)               | how the system is built (source of truth) |
| [Decisions](adr/0001-record-architecture-decisions/) | why it is built that way (ADR)            |

```mermaid
flowchart LR
  feat["feat/… · fix/…"] -- PR squash --> dev
  dev -- release/vX.Y.Z --> main
  main -- tag vX.Y.Z --> ghcr[(GHCR image)]
  main -. back-merge .-> dev
  dev -. push .-> devdocs[/dev docs/]
  main -. push .-> userdocs[/user docs/]
```
