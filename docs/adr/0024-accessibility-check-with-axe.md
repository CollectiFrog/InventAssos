---
title: "0024: Accessibility checked in CI with Playwright and axe-core"
description: The key pages are audited in Chromium at three widths on every pull request.
---

| Status   | Date       | Deciders   |
|----------|------------|------------|
| Accepted | 2026-11-11 | @tritriper |

## Context

US-0.7.9 asks for WCAG AA contrast, 44 px touch targets, a visible focus and labelled controls,
with « an automated accessibility check in CI on the key pages ». ADR 0022 adds that the check
covers the three shell widths (390, 1024, 1440 px). Server tests read HTML, but contrast, sizes and
what assistive technologies see need a real browser with the CSS applied. Nothing in the project
drove a browser until now.

## Decision

Two development dependencies, pinned:

- **`playwright`** (Apache-2.0, Microsoft, monthly releases): the browser automation that
  `remix test` already supports for `*.test.e2e.ts` files (`t.serve()`).
- **`axe-core`** (MPL-2.0, Deque, the reference engine behind most audit tools): its browser
  build is evaluated in each page, which works with the app's strict CSP.

`app/accessibility.test.e2e.ts` signs in through the pages as a visitor, a member and an admin,
and audits the key pages at 390, 1024 and 1440 px, plus a pass in the dark theme. Any WCAG 2.0,
2.1 or 2.2 A/AA violation fails it, and so does any button, field, menu or navigation link under
44 px on a phone (axe checks 24 px, the story asks 44).

`make test` keeps the server tests only (`remix.json` → `type: ["server"]`); `make a11y` runs the
browser tests in Chromium. CI runs it as its own job. The dev image installs Chromium's system
libraries; the browser is downloaded on the first `make a11y`.

## Alternatives

| Option                       | Pros                          | Cons                                                    | Why not                                  |
|------------------------------|-------------------------------|---------------------------------------------------------|------------------------------------------|
| `@axe-core/playwright`       | official wrapper              | refuses the pages `t.serve()` opens; one more package   | evaluating `axe-core` directly is enough |
| pa11y-ci                     | ready-made CLI                | starts its own browser and needs the app running in CI  | less integrated than `remix test` e2e    |
| HTML checks in server tests  | no browser, fast              | no CSS: no contrast, sizes or computed accessible names | misses what the story is about           |
| Manual audit before releases | no dependency                 | forgotten, not reproducible                             | the story asks for CI                    |

## Consequences

- A pull request that breaks contrast, a label or a touch target fails CI with the page, the rule
  and the elements concerned.
- The CI gets a fourth job (about two minutes, Chromium download included).
- A contributor without the dev container needs Chromium's libraries:
  `npx playwright install --with-deps chromium` (root on Linux).
- New key pages are added to the list in the test file.
