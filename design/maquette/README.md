# V0.7 mock-up

Clickable prototype of the V0.7 interface, one file per device. It is the source of the claude.ai
Design canvas "InventAssos — Maquette" (private artifact owned by the maintainer); the files only
render inside that canvas (`support.js` is provided by it), so open the artifact to try them.

| File                           | Holds                                                     |
|--------------------------------|-----------------------------------------------------------|
| `Prototype-Telephone.dc.html`  | phone layout (< 720 px), 390 × 844                        |
| `Prototype-Ordinateur.dc.html` | computer layout (≥ 720 px), fluid                         |
| `canvas.json`                  | position of the two artboards on the canvas and the notes |

How a prototype file is built:

- Every screen is a `<sc-if value="{{is.<Key>}}">` block wrapping `<div class="s-<Key>">`; its CSS
  is scoped with `.s-<Key>` in the `<style>` at the top.
- Template holes of a screen read `{{<Key>.name}}`, computed by the method `sv<Key>()` of the
  `Component` class; `{{to.<Key>}}` navigates, `{{to.back}}` goes back one page, `{{tabs.*}}` and
  `{{cur.*}}` highlight the section the user came from.
- `renderVals()` keeps the navigation history in `state.stack`.

Rules: copy in French, fictional data only, the two devices kept in sync, accessible markup (real
links, buttons and labels). The app itself follows [UI](../../docs/dev/architecture/ui.md); this
mock-up is a reference, not code to ship.
