---
title: "0003: Documentation site with Starlight, user docs from main, dev docs from dev"
description: One GitHub Pages site, two zones built from two branches.
---

| Status   | Date       | Deciders   |
|----------|------------|------------|
| Accepted | 2026-11-07 | @tritriper |

## Context

Users need docs that match the released version (`main`). Developers need docs that match the
latest integrated work (`dev`). GitHub Pages serves one site per repository. The theme must follow
a design system being built. Sources must stay plain Markdown, with Mermaid diagrams.

## Decision

- **Starlight** (Astro) renders the docs. Theme: design system tokens as CSS variables in
  `docs/site/src/styles/tokens.css`; Starlight components can be overridden if needed.
- Sources stay readable: `docs/user/`, `docs/dev/`, `docs/adr/`. One app in `docs/site/` builds
  either site (`DOCS_SITE=user|dev`).
- `docs.yml` runs on every push to `main` or `dev` and always builds **user from `main`** at `/`
  and **dev from `dev`** at `/dev/` (ADRs included), then deploys both. Neither zone can show
  the other branch's content. Each site links to the other.

## Alternatives

| Option          | Pros                         | Cons                                               |
|-----------------|------------------------------|----------------------------------------------------|
| MkDocs Material | mature, used in KyberFrog    | in maintenance, support ended 2026-11-05           |
| Zensical        | successor of MkDocs Material | very young ecosystem                               |
| VitePress       | very simple                  | Vue-only customisation, weaker component overrides |
| Docusaurus      | versioning, large ecosystem  | heavier React setup to maintain                    |
| Two Pages sites | full separation              | needs a second repository                          |

## Consequences

Node is needed to preview the docs. Search is per zone. A Starlight major upgrade is a
reviewed PR (Dependabot opens it).
