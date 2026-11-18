# UI references

References for the Linear-style interface ([UI guidelines](../../../docs/dev/design/ui-guidelines.md)).
Screenshots of third-party products are **local references only**: `*.png` here is git-ignored
(public MIT repository); only this list of links is committed. Look, never copy code or assets
(Plane is AGPL-3.0).

How to capture (desktop 1440 × 900, light and dark when the page offers both):

```sh
npx playwright screenshot --viewport-size=1440,900 <url> .ia/sources/ui/<file>.png
npx playwright screenshot --viewport-size=1440,900 --color-scheme=dark <url> .ia/sources/ui/<file>-dark.png
```

## Links

| Reference                       | URL                                                        | File                   | Look at                                     |
|---------------------------------|------------------------------------------------------------|------------------------|---------------------------------------------|
| Linear, redesign article        | <https://linear.app/blog/how-we-redesigned-the-linear-ui>  | `linear-redesign.png`  | sidebar, list, light and dark themes        |
| Linear, homepage                | <https://linear.app>                                       | `linear-home.png`      | list, issue detail, ⌘K                      |
| Linear, changelog               | <https://linear.app/changelog>                             | `linear-changelog.png` | filters, panels, menus                      |
| Linear, screens gallery         | <https://www.saasframe.io/examples/linear-landing-page>    | `linear-gallery.png`   | Linear pages by type                        |
| Vercel Geist, overview          | <https://vercel.com/geist>                                 | `geist.png`            | overall system                              |
| Vercel Geist, colors, materials | <https://vercel.com/geist/colors>, `/geist/materials`      | `geist-colors.png`     | gray scale, radii, borders, shadows         |
| Vercel Geist, spec as text      | <https://vercel.com/design.md>                             | none (read as text)    | token names                                 |
| Plane, site                     | <https://plane.so>                                         | `plane.png`            | list views, filters, detail panel           |
| Plane, repository README        | <https://github.com/makeplane/plane>                       | `plane-readme.png`     | app screenshots (AGPL: inspiration only)    |
| Resend                          | <https://resend.com>                                       | `resend.png`           | restrained light theme, tables              |
| Raycast                         | <https://www.raycast.com>                                  | `raycast.png`          | command palette, one accent used sparingly  |
| Supabase                        | <https://supabase.com>                                     | `supabase.png`         | tables-first data UI                        |

## Capture status

2026-11-17: **not captured**. The sandbox that built the design system (`feat/ui-design-system`)
could not reach any of these hosts (network allowlist), so it worked from the guidelines and from
what is publicly known of these products. Capture them on a machine with network access before the
next design review, and compare the app's `/dev/ui` page with them.

## What we take from each

- **Linear**: surfaces one step apart instead of shadows, 1 px low-contrast borders, 13 px dense
  rows, one accent, quiet sidebar with the current entry as a grey fill, same layout in both themes.
- **Vercel Geist**: semantic token names, borders drawn as `box-shadow: 0 0 0 1px` (no layout
  shift), high-contrast accessible greys, radii of 4 to 12 px.
- **Plane**: filters as removable chips, display options (list or grid) beside them, useful empty
  states.
- **Resend**: a light theme that stays calm: white surfaces on an off-white canvas, grey text
  levels, no coloured sections.
- **Raycast**: the accent kept for the one thing to press.
- **Supabase, Stripe**: tables lead; a status is a small tinted badge with a word.
