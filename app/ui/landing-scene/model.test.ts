import { readFileSync } from 'node:fs'
import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'
import {
  dashboard,
  gear,
  places,
  sceneStylesheet,
  selectionHeight,
  selectionSpot,
} from './model.ts'

describe('landing scene', () => {
  it('ships the stylesheet generated from the model (npm run landing:css)', () => {
    const committed = readFileSync(
      new URL('../../../public/landing-scene.css', import.meta.url),
      'utf8',
    )
    assert.equal(
      committed,
      sceneStylesheet(),
      'public/landing-scene.css is stale: run npm run landing:css',
    )
  })

  it('gives every piece of gear its own slot in the dashboard grid', () => {
    assert.ok(gear.length <= dashboard.grid.columns * dashboard.grid.rows)
    assert.equal(new Set(gear.map((piece) => piece.id)).size, gear.length)
  })

  it('brings gear from every place to the party, and fits it in the selection box', () => {
    const chosen = gear.filter((piece) => piece.party)
    assert.deepEqual(
      new Set(chosen.map((piece) => piece.colour)),
      new Set(places.map((place) => place.colour)),
    )
    const lastLabel = selectionSpot(chosen.length - 1)[1] + 17
    assert.ok(lastLabel <= dashboard.selection.y + selectionHeight())
  })
})
