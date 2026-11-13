import * as assert from 'remix/assert'
import type { Database } from 'remix/data-table'
import { after, before, beforeEach, describe, it } from 'remix/test'

import { createActiveCollectif } from '../../../test/collectifs.ts'
import { openTestDatabase, resetDatabase } from '../../../test/database.ts'
import { createTestItem } from '../../../test/items.ts'
import { createTestLocation } from '../../../test/locations.ts'
import { createActiveUser } from '../../../test/users.ts'
import { archiveItem } from '../../data/items.ts'
import { listMyCollectifs } from '../../data/members.ts'
import type { Collectif, Item, Location, User } from '../../data/tables.ts'
import type { CurrentUser } from '../../middleware/current-user.ts'
import { inventoryHeaderRow } from './format.ts'
import { type ColumnMapping, planImport } from './plan.ts'
import { loadImportWorld } from './world.ts'

describe('the world of an import, from the database (ADR 0027)', () => {
  let db: Database
  let rita: User
  let frog: Collectif
  let local: Location
  let cave: Location
  let amp: Item
  let sold: Item

  before(async () => {
    db = await openTestDatabase()
  })
  beforeEach(async () => {
    await resetDatabase(db)
    rita = await createActiveUser(db, 'Rita', 'rita@example.org')
    frog = await createActiveCollectif(db, "Collecti'FROG", rita.id)
    const other = await createActiveCollectif(db, 'Autre collectif', rita.id)
    local = await createTestLocation(db, { collectifId: frog.id }, 'Local')
    cave = await createTestLocation(db, { collectifId: frog.id }, 'Cave')
    const elsewhere = await createTestLocation(db, { collectifId: other.id }, 'Ailleurs')
    const owner = { collectifId: frog.id }
    amp = await createTestItem(db, {
      locationId: local.id,
      owner,
      createdBy: rita.id,
      name: 'Ampli',
      ref: 'Été-1',
    })
    sold = await createTestItem(db, {
      locationId: cave.id,
      owner,
      createdBy: rita.id,
      name: 'Pied',
      ref: 'OLD-1',
    })
    await archiveItem(db, sold.id, 'sold')
    // The same reference under another owner is another item.
    await createTestItem(db, {
      locationId: elsewhere.id,
      owner: { collectifId: other.id },
      createdBy: rita.id,
      ref: 'X-1',
    })
  })
  after(async () => {
    await db.close()
  })

  async function actor(): Promise<CurrentUser> {
    const collectifs = await listMyCollectifs(db, rita.id)
    return {
      id: rita.id,
      name: rita.name,
      email: rita.email,
      status: 'active',
      isAdmin: false,
      isModerator: false,
      managedCollectifIds: new Set(collectifs.map((c) => c.id)),
      memberCollectifIds: new Set(collectifs.map((c) => c.id)),
      collectifs,
    }
  }

  const columns: ColumnMapping = [
    'ref',
    'name',
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    'location',
    'id',
  ]
  const file = (rows: string[][]) => ({
    header: inventoryHeaderRow(),
    rows: rows.map((cells, index) => ({
      n: index + 2,
      cells: columns.map((field) =>
        field === 'ref'
          ? (cells[0] ?? '')
          : field === 'name'
            ? (cells[1] ?? '')
            : field === 'id'
              ? (cells[2] ?? '')
              : '',
      ),
    })),
  })

  it('matches references in SQL: case, accents and NFD folded, per owner, archived included', async () => {
    const rows = file([['ETE-1'], ['Été-1'.normalize('NFD')], ['old-1'], ['X-1']])
    const world = await loadImportWorld(db, await actor(), local, rows, columns)
    assert.equal(world.refs.get('ETE-1')?.item?.id, amp.id)
    assert.equal(world.refs.get('Été-1')?.item?.id, amp.id, 'NFD is normalised before the lookup')
    assert.equal(world.refs.get('old-1')?.item?.archived, true)
    assert.equal(world.refs.get('X-1')?.item, null, 'another owner’s reference')
    assert.equal(world.refs.get('ETE-1')?.key, world.refs.get('Été-1')?.key)
    assert.deepEqual(world.locations.map((place) => place.name).sort(), ['Cave', 'Local'])
    assert.equal(world.namesByLocation.get(local.id)?.has('ampli'), true)
  })

  it('finds items by Identifiant within the owner only', async () => {
    const rows = file([
      ['', '', amp.id.toUpperCase()],
      ['', '', '00000000-0000-4000-8000-000000000000'],
      ['', '', 'pas-un-id'],
    ])
    const world = await loadImportWorld(db, await actor(), local, rows, columns)
    assert.equal(world.itemsById.get(amp.id)?.changeable, true)
    assert.equal(world.itemsById.size, 1)
  })

  it('looks a reference up under the key it was loaded with: spaces collapsed', async () => {
    const owner = { collectifId: frog.id }
    await createTestItem(db, {
      locationId: local.id,
      owner,
      createdBy: rita.id,
      name: 'Mix',
      ref: 'MIX 01',
    })
    const rows = file([
      ['MIX  01', 'Mix'],
      ['mix\u00a001', 'Mix bis'],
    ])
    const world = await loadImportWorld(db, await actor(), local, rows, columns)
    const plan = planImport(rows, columns, { category: {}, condition: {}, location: {} }, world)
    assert.deepEqual(
      plan.rows.map((row) => row.state),
      ['invalid', 'invalid'],
      'both name the same existing item',
    )
  })

  it('never reaches another owner’s item by Identifiant, nor archived names', async () => {
    const other = await createActiveCollectif(db, 'Tiers', rita.id)
    const theirs = await createTestLocation(db, { collectifId: other.id }, 'Ailleurs 2')
    const foreign = await createTestItem(db, {
      locationId: theirs.id,
      owner: { collectifId: other.id },
      createdBy: rita.id,
    })
    const rows = file([['', '', foreign.id]])
    const world = await loadImportWorld(db, await actor(), local, rows, columns)
    assert.equal(world.itemsById.size, 0)
    assert.equal(world.namesByLocation.get(cave.id)?.has('pied') ?? false, false, 'archived')
  })

  it('works for a person’s own locations, and refuses someone without rights', async () => {
    const garage = await createTestLocation(db, { userId: rita.id }, 'Garage')
    const mine = await createTestItem(db, {
      locationId: garage.id,
      owner: { userId: rita.id },
      createdBy: rita.id,
      ref: 'PERSO-1',
    })
    const rows = file([['perso-1']])
    const world = await loadImportWorld(db, await actor(), garage, rows, columns)
    assert.equal(world.refs.get('perso-1')?.item?.id, mine.id)
    assert.equal(world.maySetRef, true)
    const lou = await createActiveUser(db, 'Lou', 'lou@example.org')
    const outsider: CurrentUser = {
      ...(await actor()),
      id: lou.id,
      managedCollectifIds: new Set(),
      memberCollectifIds: new Set(),
      collectifs: [],
    }
    await assert.rejects(() => loadImportWorld(db, outsider, local, rows, columns))
  })

  it('plans with the real world: an update, an archived row, a creation', async () => {
    const rows = file([
      ['ete-1', 'Ampli rouge'],
      ['OLD-1', 'Pied'],
      ['NEW-1', 'Lyre'],
    ])
    const world = await loadImportWorld(db, await actor(), local, rows, columns)
    const plan = planImport(rows, columns, { category: {}, condition: {}, location: {} }, world)
    assert.deepEqual(
      plan.rows.map((row) => row.state),
      ['update', 'archived', 'create'],
    )
    assert.deepEqual(plan.rows[0]?.changed, ['name'])
    assert.equal(plan.rows[2]?.fields?.ref, 'NEW-1')
  })
})
