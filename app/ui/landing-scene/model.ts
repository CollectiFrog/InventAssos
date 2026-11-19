// The landing page's animated scene (US-0.10.24, ADR 0039): its places, gear and people, the
// isometric geometry, and the keyframes written to public/landing-scene.css by `npm run landing:css`.

/** A point in SVG user units. */
export type Point = readonly [x: number, y: number]

/** The whole drawing, in user units; computers show it all, phones the part in `phoneView`. */
export const viewBox = { x: 130, y: 0, width: 1070, height: 602 } as const

/** The part of the drawing phones keep: the village and the dashboard, without empty margins. */
export const phoneView = { x: 450, y: 25, width: 750, height: 600 } as const

// 2:1 isometric grid: one tile is 60 × 30 units; the village is 12 × 12 tiles.
const tileHalfWidth = 30
const tileHalfHeight = 15
const villageOrigin: Point = [830, 165]
const neighbourOrigin: Point = [1090, 40]

/** Projects a point of the village grid (i, j) at height z onto the drawing. */
export function iso(i: number, j: number, z = 0): Point {
  return projectFrom(villageOrigin, i, j, z)
}

/** Projects a point of the neighbour's island, outside the collectif. */
export function isoNeighbour(i: number, j: number, z = 0): Point {
  return projectFrom(neighbourOrigin, i, j, z)
}

function projectFrom([ox, oy]: Point, i: number, j: number, z: number): Point {
  return [ox + (i - j) * tileHalfWidth, oy + (i + j) * tileHalfHeight - z]
}

/** Colour slot of a place: 1 to 4 for the collectif's places, 0 for the neighbour (grey). */
export type PlaceColour = 0 | 1 | 2 | 3 | 4

/** A building: its footprint on the grid and its wall height. */
export interface Building {
  name: string
  colour: PlaceColour
  from: readonly [i: number, j: number]
  to: readonly [i: number, j: number]
  height: number
}

/** The collectif's four places, each with its colour. */
export const places: readonly Building[] = [
  { name: 'Local', colour: 1, from: [1, 1], to: [3.5, 3], height: 40 },
  { name: 'Chez Camille', colour: 2, from: [8.5, 1], to: [10.5, 2.8], height: 34 },
  { name: 'Garage de Malik', colour: 3, from: [1, 8], to: [3, 10.5], height: 30 },
  { name: 'Atelier', colour: 4, from: [8.8, 8.6], to: [10.8, 10.6], height: 32 },
]

/** The party hall in the middle of the village: flat roof, sign, garland. */
export const hall: Building = {
  name: 'Salle des fêtes',
  colour: 0,
  from: [5, 5],
  to: [7.5, 7.5],
  height: 46,
}

/** The neighbour's house, outside the collectif's fence: its gear never joins the dashboard. */
export const neighbourHouse: Building = {
  name: 'Voisin',
  colour: 0,
  from: [0.5, 0.5],
  to: [1.8, 1.8],
  height: 26,
}

/** Pictograms drawn on the gear's pins (`#landing-<name>` symbols in the scene). */
export type Pictogram =
  | 'speaker'
  | 'mic'
  | 'table'
  | 'spot'
  | 'reel'
  | 'tent'
  | 'garland'
  | 'drill'
  | 'mixer'
  | 'chair'

/** One piece of gear: where it is kept, and where it stands at the party if it goes. */
export interface Gear {
  id: number
  colour: PlaceColour
  pictogram: Pictogram
  label: string
  home: readonly [i: number, j: number]
  party?: readonly [i: number, j: number]
}

/** Ten pieces of gear; the six with a `party` spot come from all four places. */
export const gear: readonly Gear[] = [
  {
    id: 1,
    colour: 1,
    pictogram: 'speaker',
    label: 'Enceinte',
    home: [1.6, 4.3],
    party: [5.3, 8.6],
  },
  { id: 2, colour: 1, pictogram: 'mic', label: 'Micro', home: [2.9, 4.3], party: [6.5, 8.7] },
  { id: 3, colour: 1, pictogram: 'table', label: 'Table pliante', home: [4.3, 3.2] },
  { id: 4, colour: 2, pictogram: 'spot', label: 'Projecteur', home: [9, 3.9], party: [8.6, 5.3] },
  { id: 5, colour: 2, pictogram: 'reel', label: 'Rallonge 25 m', home: [10.3, 3.9] },
  { id: 6, colour: 3, pictogram: 'tent', label: 'Barnum 3×3', home: [4, 9], party: [7.7, 8.7] },
  {
    id: 7,
    colour: 3,
    pictogram: 'garland',
    label: 'Guirlande',
    home: [4, 10.3],
    party: [8.7, 6.4],
  },
  { id: 8, colour: 3, pictogram: 'drill', label: 'Perceuse', home: [2.2, 11.4] },
  {
    id: 9,
    colour: 4,
    pictogram: 'mixer',
    label: 'Console son',
    home: [8.2, 11.5],
    party: [8.7, 7.5],
  },
  { id: 10, colour: 4, pictogram: 'chair', label: 'Chaises ×20', home: [11.5, 9] },
]

/** One inhabitant per place: at home, then at the party. */
export const people: readonly {
  id: number
  colour: PlaceColour
  home: readonly [number, number]
  party: readonly [number, number]
}[] = [
  { id: 1, colour: 1, home: [3.9, 5.3], party: [6, 9.7] },
  { id: 2, colour: 2, home: [7.7, 3.2], party: [9.7, 6] },
  { id: 3, colour: 3, home: [5.3, 10.4], party: [7.2, 9.9] },
  { id: 4, colour: 4, home: [11.4, 10.8], party: [9.9, 7.2] },
]

/** Bulbs on each of the hall's two garlands. */
export const garlandBulbs = 9

/** The dashboard card the gear lines up in: a 4 × 3 grid, and a box for the party's selection. */
export const dashboard = {
  x: 530,
  y: 150,
  width: 640,
  height: 430,
  tile: { width: 92, height: 96, gap: 10 },
  grid: { x: 556, y: 246, columns: 4, rows: 3 },
  selection: { x: 975, y: 246, width: 170 },
} as const

/** Where a pin stands (its tip) in grid slot `k` of the dashboard. */
export function tileSpot(k: number): Point {
  const { tile, grid } = dashboard
  const column = k % grid.columns
  const row = Math.floor(k / grid.columns)
  return [
    grid.x + column * (tile.width + tile.gap) + tile.width / 2,
    grid.y + row * (tile.height + tile.gap) + 60,
  ]
}

/** Where a pin stands in slot `k` of the selection box (two columns). */
export function selectionSpot(k: number): Point {
  const { selection } = dashboard
  return [selection.x + (k % 2 ? 125 : 45), selection.y + 92 + Math.floor(k / 2) * 94]
}

/** Height of the selection box: as tall as the grid. */
export function selectionHeight(): number {
  const { tile, grid } = dashboard
  return grid.rows * tile.height + (grid.rows - 1) * tile.gap
}

const round = (n: number) => Math.round(n * 10) / 10
const at = ([x, y]: Point) => `transform: translate(${round(x)}px, ${round(y)}px)`
const pct = (n: number) => `${round(n)}%`

/**
 * The stylesheet of the scene's timeline (one loop is `--duration-scene`): village 0-18 %, gear
 * lines up in the dashboard 18-40 %, six pieces chosen for the party 40-56 %, back to the village
 * and the party 56-84 %, everyone home 84-100 %. Pure, so a test checks the committed file.
 */
export function sceneStylesheet(): string {
  const lines: string[] = [
    '/* Generated from app/ui/landing-scene/model.ts by `npm run landing:css`: do not edit. */',
    '/* Opacity and transform only (tokens.css); `prefers-reduced-motion` stops on the village. */',
    '',
  ]
  const timed =
    '.landing-scene .timed { animation-duration: var(--duration-scene); animation-iteration-count: infinite; animation-timing-function: cubic-bezier(0.65, 0, 0.35, 1); }'
  lines.push(timed)

  // Phones scale the drawing so that `phoneView` fits the scene's box (a size container).
  const r2 = (n: number) => Math.round(n * 100) / 100
  const cx = phoneView.x + phoneView.width / 2 - viewBox.x
  const cy = phoneView.y + phoneView.height / 2 - viewBox.y
  const fit = (units: number) =>
    `min(${r2((units / phoneView.width) * 100)}cqw, ${r2((units / phoneView.height) * 100)}cqh)`
  lines.push(
    `.landing-scene { --landing-phone-width: ${fit(viewBox.width)}; --landing-phone-left: calc(50cqw - ${fit(cx)}); --landing-phone-top: calc(50cqh - ${fit(cy)}); }`,
  )

  let selected = 0
  gear.forEach((piece, k) => {
    // A small stagger, so that the gear does not move as one block.
    const s = k * 0.5
    const home = iso(...piece.home)
    const tile = tileSpot(k)
    let frames: string
    if (piece.party) {
      const chosen = selectionSpot(selected++)
      const party = iso(...piece.party)
      frames = [
        `0% { ${at(home)}; }`,
        `${pct(18 + s)} { ${at(home)}; }`,
        `${pct(27 + s)} { ${at(tile)}; }`,
        `${pct(40 + s)} { ${at(tile)}; }`,
        `${pct(47 + s)} { ${at(chosen)}; }`,
        `56% { ${at(chosen)}; }`,
        `${pct(64 + s * 0.4)} { ${at(party)}; }`,
        `${pct(84 + s * 0.4)} { ${at(party)}; }`,
        `${pct(95 + s * 0.4)} { ${at(home)}; }`,
        `100% { ${at(home)}; }`,
      ].join(' ')
    } else {
      frames = [
        `0% { ${at(home)}; opacity: 1; }`,
        `${pct(18 + s)} { ${at(home)}; }`,
        `${pct(27 + s)} { ${at(tile)}; }`,
        '40% { opacity: 1; }',
        '45% { opacity: 0.3; }',
        `56% { ${at(tile)}; opacity: 0.3; }`,
        `${pct(64 + s * 0.4)} { ${at(home)}; opacity: 1; }`,
        `100% { ${at(home)}; opacity: 1; }`,
      ].join(' ')
    }
    lines.push(`@keyframes landing-gear-${piece.id} { ${frames} }`)
    lines.push(
      `.landing-gear-${piece.id} { ${at(home)}; animation-name: landing-gear-${piece.id}; }`,
    )
  })

  for (const person of people) {
    const home = iso(...person.home)
    const party = iso(...person.party)
    lines.push(
      `@keyframes landing-person-${person.id} { 0% { ${at(home)}; opacity: 1; } 18% { ${at(home)}; opacity: 1; } 23% { ${at(home)}; opacity: 0; } 58% { ${at(party)}; opacity: 0; } 63% { ${at(party)}; opacity: 1; } 84% { ${at(party)}; } 95% { ${at(home)}; } 100% { ${at(home)}; opacity: 1; } }`,
    )
    lines.push(
      `.landing-person-${person.id} { ${at(home)}; animation-name: landing-person-${person.id}; }`,
    )
  }

  lines.push(
    '@keyframes landing-pin { 0%, 19% { opacity: 1; } 25%, 57% { opacity: 0; } 63%, 100% { opacity: 1; } }',
    '@keyframes landing-label { 0%, 25% { opacity: 0; } 30%, 53% { opacity: 1; } 57%, 100% { opacity: 0; } }',
    '@keyframes landing-village { 0%, 18% { opacity: 1; transform: none; } 26%, 56% { opacity: 0; transform: translateY(24px); } 64%, 100% { opacity: 1; transform: none; } }',
    '@keyframes landing-neighbour { 0%, 18% { opacity: 1; } 26%, 56% { opacity: 0.4; } 64%, 100% { opacity: 1; } }',
    '@keyframes landing-dashboard { 0%, 20% { opacity: 0; transform: translateY(-14px); } 28%, 54% { opacity: 1; transform: none; } 60%, 100% { opacity: 0; transform: translateY(-14px); } }',
    '@keyframes landing-selection { 0%, 41% { opacity: 0; } 47%, 56% { opacity: 1; } 60%, 100% { opacity: 0; } }',
    '@keyframes landing-party { 0%, 62% { opacity: 0; } 67%, 84% { opacity: 1; } 89%, 100% { opacity: 0; } }',
    '.landing-pin { animation-name: landing-pin; }',
    '.landing-label { animation-name: landing-label; }',
    '.landing-village { animation-name: landing-village; }',
    '.landing-neighbour { animation-name: landing-neighbour; }',
    '.landing-dashboard { animation-name: landing-dashboard; }',
    '.landing-selected, .landing-selection-count { animation-name: landing-selection; }',
    '.landing-party { animation-name: landing-party; }',
  )
  for (let k = 0; k < garlandBulbs; k++) {
    lines.push(`.landing-bulb-${k} { animation-delay: -${(k * 0.17).toFixed(2)}s; }`)
  }
  return `${lines.join('\n')}\n`
}
