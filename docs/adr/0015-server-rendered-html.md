---
title: "0015: Server-rendered HTML, no client JavaScript in V0.x"
description: Pages are Remix components rendered on the server; forms are plain HTML forms.
---

| Status   | Date       | Deciders              |
|----------|------------|-----------------------|
| Proposed | 2026-11-08 | @claude (nightly run) |

## Context

The V0.x screens are lists and forms used from a laptop or a phone in a storage room. Remix 3 can
hydrate components with `clientEntry()`, which needs an asset server and a browser entry script.

## Decision

Pages are Remix components rendered on the server through `context.render()`. Forms are native
`<form method="post">` handled by route actions, then a `303` redirect. No asset server and no
browser bundle; styles are one static file, `public/styles.css`.

## Alternatives

| Option                                         | Pros                            | Cons                               | Why not now                 |
|------------------------------------------------|---------------------------------|------------------------------------|-----------------------------|
| Template default (asset server, `clientEntry`) | pending states, no full reloads | build pipeline, CSP and cache work | not needed for CRUD screens |
| `css()` mixins in components                   | styles next to markup           | styles repeated in every response  | one cached file is simpler  |

## Consequences

- Works without JavaScript, on any phone; nothing to compile.
- Interactive widgets (photo preview in V0.9, import mapping in V0.10) may bring the asset server
  back; that is a new ADR superseding this one.
