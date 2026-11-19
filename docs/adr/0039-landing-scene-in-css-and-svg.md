---
title: "0039: Landing page scene in CSS and SVG"
description: Visitors land on one screen with an animated isometric scene, drawn on the server in SVG and animated by a generated stylesheet, without script.
---

| Status   | Date       | Deciders   |
|----------|------------|------------|
| Accepted | 2026-11-19 | @tritriper |

## Context

Visitors reached a title, one sentence and two buttons: nothing said at a glance what AssoMatos is
for. The maintainer wanted a page that tells it with motion design, for collectif responsibles
first, on one screen with no scroll, on computers and phones (US-0.10.24). The story was chosen on
a mock-up: an isometric village whose gear, coloured by place, lines up in a dashboard, gathers
for a party, then goes home.

The content policy allows no script and no inline style
([0015](../0015-server-rendered-html/), `security-headers.ts`): Lottie, Rive or GSAP need
JavaScript, a video needs `media-src`, and a `<style>` or `style=""` in the page is refused.

## Decision

- **Inline SVG drawn on the server** by `app/ui/landing-scene/scene.tsx` from one model,
  `app/ui/landing-scene/model.ts`: places, gear, people, isometric projection, dashboard grid.
- **Animated by CSS keyframes only**, opacity and transform, in two static files: `landing.css`
  (layout, line drawing, tokens) and `landing-scene.css`, **generated** from the same model by
  `npm run landing:css` and committed. A test fails while the committed file is stale, so the
  drawing and its timeline cannot drift apart. The generated file is left out of Biome.
- **Colours are tokens**: one per place (`--place-0` to `--place-4`), the drawing's line and
  ground (`--scene-*`), the loop (`--duration-scene`); both themes, previewed on `/dev/ui`.
- **The scene is decorative** (`aria-hidden`): the heading, sentence and links say everything.
  With `prefers-reduced-motion`, it stays on the village.
- **Layout `bare`**: the landing page has no shell (top bar, navigation) and fills the screen; a
  page may add its own stylesheets. Landscape screens put the text over the scene's empty left
  side; portrait screens and phones stack the scene, the text, the footer.
- **The logo is Collecti'FROG's frog**, `public/logo.svg`, painted as a CSS mask over the accent
  colour, so it follows the theme (`#595082`, the brand's purple, confirmed by the brand files).

## Alternatives

| Option                                | Pros                              | Cons                                         | Why not                                 |
|---------------------------------------|-----------------------------------|----------------------------------------------|-----------------------------------------|
| Lottie or Rive animation              | made in a design tool             | needs a script, a new dependency family      | the CSP forbids scripts (0015)          |
| Looping video                         | any look                          | `media-src`, weight, no dark theme           | heavy, does not follow the theme        |
| Keyframes written by hand             | no generator                      | positions duplicated between SVG and CSS     | they drift at the first change          |
| Stylesheet served by a route          | no generated file in the repo     | a runtime route for static content           | a committed file is simpler to review   |
| Animated SVG file in `<img>`          | one file                          | no theme tokens inside an `<img>`            | must follow light and dark              |

## Consequences

- Changing the scene means editing `model.ts` (or `scene.tsx`), then `npm run landing:css`.
- The page weighs about 20 kB of HTML (the SVG included), 17 kB of CSS and a 10 kB logo, uncompressed.
- Very small screens (under about 600 px tall) scroll rather than clip the text.
