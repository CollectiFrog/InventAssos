// The landing page's scene, drawn on the server from model.ts. Decorative: the page's text says
// the same, so the drawing is hidden from assistive technology (US-0.10.24, ADR 0039).
import type { Handle, RemixNode } from 'remix/component'
import {
  type Building,
  dashboard,
  garlandBulbs,
  gear,
  hall,
  iso,
  isoNeighbour,
  neighbourHouse,
  type Pictogram,
  type Point,
  people,
  places,
  selectionHeight,
  tileSpot,
  viewBox,
} from './model.ts'

type Project = (i: number, j: number, z?: number) => Point

const points = (list: Point[]) => list.map(([x, y]) => `${x},${y}`).join(' ')

/** Pictograms of the gear, on a 24 unit grid, drawn with the scene's line. */
const pictograms: Record<Pictogram | 'heart', RemixNode> = {
  speaker: (
    <>
      <rect x="6" y="3" width="12" height="18" rx="2" />
      <circle cx="12" cy="8.5" r="2" />
      <circle cx="12" cy="15" r="3.5" />
    </>
  ),
  mic: (
    <>
      <rect x="9" y="3" width="6" height="10" rx="3" />
      <path d="M6 11a6 6 0 0 0 12 0M12 17v4M9 21h6" />
    </>
  ),
  table: <path d="M3 8h18v3H3zM6 11v9M18 11v9" />,
  spot: <path d="M4 7h9l5-3v14l-5-3H4zM8 15v5M5 20h6" />,
  reel: (
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3" />
      <path d="M20 12h2" />
    </>
  ),
  tent: <path d="M3 10l9-6 9 6zM5 10v10M19 10v10M3 10q2.25 3 4.5 0t4.5 0 4.5 0 4.5 0" />,
  garland: (
    <>
      <path d="M2 6q10 9 20 0" />
      <circle cx="6.5" cy="10" r="2" />
      <circle cx="12" cy="11.5" r="2" />
      <circle cx="17.5" cy="10" r="2" />
    </>
  ),
  drill: <path d="M3 6h12v6H3zM15 8h6M7 12l-1 8h5l1-8" />,
  mixer: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M7 9v6M12 8v8M17 10v4" />
    </>
  ),
  chair: <path d="M8 3v18M8 12h9v9M8 7h4" />,
  heart: <path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z" />,
}

/** A house: two walls, a door, and a pyramid roof in its place's colour (or a flat roof). */
function House(handle: Handle<{ building: Building; project: Project; flat?: boolean }>) {
  return () => {
    const { building, project: p, flat } = handle.props
    const [i0, j0] = building.from
    const [i1, j1] = building.to
    const h = building.height
    const im = (i0 + i1) / 2
    const apex = p(im, (j0 + j1) / 2, h + 20)
    return (
      <g class={`landing-place-${building.colour}`}>
        <polygon
          class="landing-wall-left"
          points={points([p(i0, j1), p(i1, j1), p(i1, j1, h), p(i0, j1, h)])}
        />
        <polygon
          class="landing-wall-right"
          points={points([p(i1, j1), p(i1, j0), p(i1, j0, h), p(i1, j1, h)])}
        />
        <polygon
          class="landing-door"
          points={points([
            p(im - 0.22, j1),
            p(im + 0.22, j1),
            p(im + 0.22, j1, 15),
            p(im - 0.22, j1, 15),
          ])}
        />
        {flat ? (
          <polygon
            class="landing-roof-flat"
            points={points([p(i0, j0, h), p(i1, j0, h), p(i1, j1, h), p(i0, j1, h)])}
          />
        ) : (
          <>
            <polygon class="landing-roof-a" points={points([p(i0, j0, h), p(i0, j1, h), apex])} />
            <polygon class="landing-roof-b" points={points([p(i0, j0, h), p(i1, j0, h), apex])} />
            <polygon class="landing-roof-c" points={points([p(i0, j1, h), p(i1, j1, h), apex])} />
            <polygon class="landing-roof-d" points={points([p(i1, j1, h), p(i1, j0, h), apex])} />
          </>
        )}
      </g>
    )
  }
}

/** A square of ground with its two visible sides. */
function Ground(handle: Handle<{ project: Project; size: number; depth: number }>) {
  return () => {
    const { project: p, size: n, depth } = handle.props
    return (
      <>
        <polygon
          class="landing-side-left"
          points={points([p(0, n), p(n, n), p(n, n, -depth), p(0, n, -depth)])}
        />
        <polygon
          class="landing-side-right"
          points={points([p(n, n), p(n, 0), p(n, 0, -depth), p(n, n, -depth)])}
        />
        <polygon class="landing-ground" points={points([p(0, 0), p(n, 0), p(n, n), p(0, n)])} />
      </>
    )
  }
}

/** A path of beaten earth between two points of the village. */
function Trail(handle: Handle<{ from: readonly [number, number]; to: readonly [number, number] }>) {
  return () => {
    const [x1, y1] = iso(...handle.props.from)
    const [x2, y2] = iso(...handle.props.to)
    return <path class="landing-trail" d={`M${x1} ${y1} L${x2} ${y2}`} />
  }
}

function Tree(handle: Handle<{ at: readonly [number, number] }>) {
  return () => {
    const [x, y] = iso(...handle.props.at)
    return (
      <g>
        <path class="landing-trunk" d={`M${x} ${y} V${y - 16}`} />
        <circle class="landing-crown" cx={x} cy={y - 24} r="10" />
      </g>
    )
  }
}

/** One of the hall's garlands: bulbs of every place's colour, sagging between two corners. */
function Garland(handle: Handle<{ from: Point; to: Point; start: number }>) {
  return () => {
    const { from, to, start } = handle.props
    const bulbs = Array.from({ length: garlandBulbs }, (_, k) => {
      const t = k / (garlandBulbs - 1)
      const x = from[0] + (to[0] - from[0]) * t
      const y = from[1] + (to[1] - from[1]) * t + Math.sin(t * Math.PI) * 8
      const colour = ((k + start) % 4) + 1
      return (
        <circle
          class={`landing-bulb landing-bulb-${k} landing-place-${colour}`}
          cx={Math.round(x * 10) / 10}
          cy={Math.round(y * 10) / 10}
          r="3.2"
        />
      )
    })
    return <>{bulbs}</>
  }
}

/** The animated scene: village, neighbour, party lights, dashboard, people and gear. */
export function LandingScene() {
  return () => {
    const [hi0, hj0] = hall.from
    const [hi1, hj1] = hall.to
    const hh = hall.height
    const [bx, by] = iso((hi0 + hi1) / 2, (hj0 + hj1) / 2, hh)
    const { tile, grid, selection } = dashboard
    const tiles = Array.from({ length: grid.columns * grid.rows }, (_, k) => tileSpot(k))
    let chipX = dashboard.x + 26
    const chips = places.map((place) => {
      const width = place.name.length * 6.6 + 30
      const x = chipX
      chipX += width + 8
      return { place, x, width }
    })
    const [nx, ny] = isoNeighbour(2.4, 2.5)

    return (
      <svg
        class="landing-art"
        viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
        preserveAspectRatio="xMaxYMid meet"
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          {Object.entries(pictograms).map(([name, shape]) => (
            <symbol
              id={`landing-${name}`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              {shape}
            </symbol>
          ))}
        </defs>

        <g class="landing-village timed">
          <Ground project={iso} size={12} depth={10} />
          <Trail from={[2.2, 3.4]} to={[2.2, 6.2]} />
          <Trail from={[2.2, 6.2]} to={[5, 6.2]} />
          <Trail from={[7.5, 1.9]} to={[7.5, 5]} />
          <Trail from={[3.2, 9.2]} to={[5.6, 9.2]} />
          <Trail from={[5.6, 9.2]} to={[5.6, 7.5]} />
          <Trail from={[8.8, 9.6]} to={[7.5, 8.3]} />
          <polygon
            class="landing-fence"
            points={points([iso(-0.4, -0.4), iso(12.4, -0.4), iso(12.4, 12.4), iso(-0.4, 12.4)])}
          />
          <Tree at={[6.2, 1.4]} />
          <Tree at={[0.6, 6.4]} />
          <Tree at={[11.4, 6.2]} />
          <Tree at={[5.6, 11.4]} />
          {places.map((place) => (
            <House building={place} project={iso} />
          ))}
          <House building={hall} project={iso} flat />
          <polygon
            class="landing-sign"
            points={points([
              iso(hi0 + 0.3, hj1, hh),
              iso(hi1 - 0.3, hj1, hh),
              iso(hi1 - 0.3, hj1, hh + 14),
              iso(hi0 + 0.3, hj1, hh + 14),
            ])}
          />
        </g>

        <g class="landing-neighbour timed">
          <Ground project={isoNeighbour} size={3} depth={8} />
          <House building={neighbourHouse} project={isoNeighbour} />
          <g class="landing-place-0" transform={`translate(${nx} ${ny})`}>
            <ellipse class="landing-shadow" rx="8" ry="3" />
            <path class="landing-tip" d="M-5 -9 L0 0 L5 -9 Z" />
            <circle class="landing-badge" cy="-22" r="13" />
            <circle class="landing-dot" cy="-22" r="4" />
          </g>
        </g>

        <g class="landing-party timed">
          <polygon
            class="landing-beam"
            points={`${bx - 6},${by} ${bx - 70},${by - 150} ${bx + 70},${by - 150} ${bx + 6},${by}`}
          />
          <Garland from={iso(hi0, hj1, hh - 6)} to={iso(hi1, hj1, hh - 6)} start={0} />
          <Garland from={iso(hi1, hj1, hh - 6)} to={iso(hi1, hj0, hh - 6)} start={2} />
        </g>

        <g class="landing-dashboard timed">
          <rect
            class="landing-panel"
            x={dashboard.x}
            y={dashboard.y}
            width={dashboard.width}
            height={dashboard.height}
            rx="18"
          />
          <text class="landing-panel-title" x={dashboard.x + 26} y={dashboard.y + 42}>
            Matériel du collectif
          </text>
          <text
            class="landing-panel-meta"
            x={dashboard.x + dashboard.width - 26}
            y={dashboard.y + 42}
            text-anchor="end"
          >
            {`${gear.length} objets · ${places.length} lieux`}
          </text>
          {chips.map(({ place, x, width }) => (
            <g class={`landing-place-${place.colour}`}>
              <rect
                class="landing-chip"
                x={x}
                y={dashboard.y + 56}
                width={width}
                height="24"
                rx="12"
              />
              <circle class="landing-dot" cx={x + 13} cy={dashboard.y + 68} r="4.5" />
              <text class="landing-chip-text" x={x + 23} y={dashboard.y + 72.5}>
                {place.name}
              </text>
            </g>
          ))}
          {tiles.map(([x, y]) => (
            <rect
              class="landing-tile"
              x={x - tile.width / 2}
              y={y - 60}
              width={tile.width}
              height={tile.height}
              rx="10"
            />
          ))}
          <rect
            class="landing-selection"
            x={selection.x}
            y={selection.y}
            width={selection.width}
            height={selectionHeight()}
            rx="12"
          />
          <rect
            class="landing-selected timed"
            x={selection.x}
            y={selection.y}
            width={selection.width}
            height={selectionHeight()}
            rx="12"
          />
          <use
            class="landing-selection-icon"
            href="#landing-heart"
            x={selection.x + 14}
            y={selection.y + 12}
            width="16"
            height="16"
          />
          <text class="landing-selection-title" x={selection.x + 36} y={selection.y + 25}>
            Fête de quartier
          </text>
          <text class="landing-selection-count timed" x={selection.x + 14} y={selection.y + 46}>
            {`${gear.filter((piece) => piece.party).length} objets, ${places.length} lieux`}
          </text>
        </g>

        {people.map((person) => (
          <g class={`landing-person-${person.id} landing-place-${person.colour} timed`}>
            <g class="landing-bob">
              <path class="landing-body" d="M-7 0 V-13 a7 7 0 0 1 14 0 V0 Z" />
              <circle class="landing-head" cy="-26" r="6.5" />
            </g>
          </g>
        ))}

        {gear.map((piece) => (
          <g class={`landing-gear-${piece.id} landing-place-${piece.colour} timed`}>
            <g class="landing-pin timed">
              <ellipse class="landing-shadow" rx="9" ry="3.5" />
              <path class="landing-tip" d="M-6 -10 L0 0 L6 -10 Z" />
            </g>
            <circle class="landing-badge" cy="-24" r="15" />
            <use
              class="landing-picto"
              href={`#landing-${piece.pictogram}`}
              x="-10"
              y="-34"
              width="20"
              height="20"
            />
            <text class="landing-label timed" y="17" text-anchor="middle">
              {piece.label}
            </text>
          </g>
        ))}
      </svg>
    )
  }
}
