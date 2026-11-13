# Mock-up up to V1.0

Clickable prototype of the interface up to V1.0 (account, administration, import and export,
legal pages, sign-in), one file per device. It is the source of the claude.ai
Design canvas "InventAssos — Maquette" (private artifact owned by the maintainer); the files only
render inside that canvas (`support.js` is provided by it), so open the artifact to try them.

| File                           | Holds                                                     |
|--------------------------------|-----------------------------------------------------------|
| `Prototype-Telephone.dc.html`  | phone layout (< 720 px), 390 × 844                        |
| `Prototype-Ordinateur.dc.html` | computer layout (≥ 720 px): sidebar shell, fluid content  |
| `canvas.json`                  | position of the two artboards on the canvas and the notes |

How a prototype file is built:

- Every screen is a `<sc-if value="{{is.<Key>}}">` block. Early screens wrap `<div class="s-<Key>">`
  with CSS scoped by `.s-<Key>`; later ones share the `nx-` classes. Colours are theme tokens
  (`--accent`, `--surface`…) with a light and a dark palette, chosen in Mon compte.
- On the computer file, signed-in screens sit inside one shell (`{{shell.app}}`): sidebar, top bar
  and `main`, with the `d-` classes for the four page templates of
  [ADR 0022](../../docs/adr/0022-sidebar-navigation-on-computers.md).
- Template holes of a screen read `{{<Key>.name}}`, computed by the method `sv<Key>()` of the
  `Component` class; `{{to.<Key>}}` navigates, `{{to.back}}` goes back one page, `{{tabs.*}}` and
  `{{cur.*}}` highlight the section the user came from.
- `renderVals()` keeps the navigation history in `state.stack`.

Rules: copy in French, fictional data only, the two devices kept in sync, accessible markup (real
links, buttons and labels). The app itself follows [UI](../../docs/dev/architecture/ui.md); this
mock-up is a reference, not code to ship: once a page is built, the app is the reference and the
mock-up is not kept in sync with it.

A professional design system will replace the mock-up's look later, through the CSS custom
properties of [ADR 0019](../../docs/adr/0019-interface-conventions.md).
