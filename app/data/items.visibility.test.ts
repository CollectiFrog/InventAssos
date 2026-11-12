// ADR 0021: listings filter in SQL with the same rule as `canSeeItem`. This test builds every
// branch of the rule and checks that both sides agree, item by item, for each kind of viewer.
import * as assert from 'remix/assert'
import type { Database } from 'remix/data-table'
import { after, before, beforeEach, describe, it } from 'remix/test'

import { createActiveCollectif } from '../../test/collectifs.ts'
import { openTestDatabase, resetDatabase } from '../../test/database.ts'
import { createTestItem } from '../../test/items.ts'
import { createTestLocation } from '../../test/locations.ts'
import { createActiveUser } from '../../test/users.ts'
import type { CurrentUser } from '../middleware/current-user.ts'
import { canSeeItem, itemScopeOf } from '../permissions.ts'
import { findItemDetails, listInventory, listItemsOwnedBy, locationShowsItemTo } from './items.ts'
import { listManagedCollectifs, setResponsible } from './members.ts'
import type { User } from './tables.ts'

describe('item visibility: SQL listings match canSeeItem (ADR 0021)', () => {
  let db: Database
  let people: User[]
  let isAdmin: (user: User) => boolean

  before(async () => {
    db = await openTestDatabase()
  })
  beforeEach(async () => {
    await resetDatabase(db)
    const [rita, cora, otto, val, boss] = await Promise.all(
      ['Rita', 'Cora', 'Otto', 'Val', 'Boss'].map((name) =>
        createActiveUser(db, name, `${name.toLowerCase()}@example.org`),
      ),
    )
    if (!rita || !cora || !otto || !val || !boss) throw new Error('seed failed')
    people = [rita, cora, otto, val, boss]
    isAdmin = (user) => user.id === boss.id
    const c = await createActiveCollectif(db, 'Collectif C', rita.id)
    await setResponsible(db, { userId: cora.id, collectifId: c.id, status: 'active' })
    const d = await createActiveCollectif(db, 'Collectif D', otto.id)
    // A pending responsible does not belong to C yet.
    await setResponsible(db, { userId: val.id, collectifId: c.id, status: 'pending' })

    const places = {
      local: await createTestLocation(db, { collectifId: c.id }, 'Local C'),
      depot: await createTestLocation(db, { collectifId: d.id }, 'Dépôt D'),
      coraHome: await createTestLocation(db, { userId: cora.id }, 'Chez Cora'),
      valHome: await createTestLocation(db, { userId: val.id }, 'Chez Val'),
    }
    const owners = {
      c: { collectifId: c.id },
      d: { collectifId: d.id },
      cora: { userId: cora.id },
      val: { userId: val.id },
      otto: { userId: otto.id },
    }
    // Every owner in every place: covers each branch of the rule, and their absence.
    for (const [placeName, place] of Object.entries(places)) {
      for (const [ownerName, owner] of Object.entries(owners)) {
        await createTestItem(db, {
          locationId: place.id,
          owner,
          createdBy: rita.id,
          name: `${ownerName} @ ${placeName}`,
        })
      }
    }
  })
  after(async () => {
    await db.close()
  })

  async function actorFor(user: User): Promise<CurrentUser> {
    const collectifs = await listManagedCollectifs(db, user.id)
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      status: 'active',
      isAdmin: isAdmin(user),
      isModerator: false,
      managedCollectifIds: new Set(collectifs.map((collectif) => collectif.id)),
      collectifs,
    }
  }

  it('lists exactly the items canSeeItem allows, for every viewer', async () => {
    const all = await listInventory(db, { scope: { everything: true }, page: 1, pageSize: 100 })
    assert.equal(all.total, 20)

    for (const user of people) {
      const actor = await actorFor(user)
      const listed = await listInventory(db, { scope: itemScopeOf(actor), page: 1, pageSize: 100 })
      const expected: string[] = []
      for (const summary of all.items) {
        const item = await findItemDetails(db, summary.id)
        if (item !== null && canSeeItem(actor, item)) expected.push(summary.name)
      }
      assert.deepEqual(
        listed.items.map((item) => item.name).sort(),
        expected.sort(),
        `${user.name} sees a different set`,
      )
    }
  })

  it('gives each viewer what ADR 0021 says', async () => {
    const seen = async (name: string) => {
      const user = people.find((person) => person.name === name)
      if (!user) throw new Error(name)
      const scope = itemScopeOf(await actorFor(user))
      return (await listInventory(db, { scope, page: 1, pageSize: 100 })).items.map((i) => i.name)
    }
    // Otto: D's items, his own, and whatever sits in D's depot; never C's items elsewhere.
    const otto = await seen('Otto')
    assert.ok(otto.includes('d @ local') && otto.includes('otto @ coraHome'))
    assert.ok(otto.includes('c @ depot'))
    assert.ok(!otto.includes('c @ local') && !otto.includes('cora @ coraHome'))
    // Val, only pending at C: her items and her home's, nothing else of C.
    const val = await seen('Val')
    assert.ok(val.includes('val @ depot') && val.includes('c @ valHome'))
    assert.ok(!val.includes('c @ local') && !val.includes('cora @ coraHome'))
    // Rita sees Cora's items wherever they are, since they share C.
    assert.ok((await seen('Rita')).includes('cora @ depot'))
  })

  it("filters a collectif's and a person's items, and a location's, with the same rule", async () => {
    const byName = (name: string) => {
      const user = people.find((person) => person.name === name)
      if (!user) throw new Error(name)
      return user
    }
    const otto = itemScopeOf(await actorFor(byName('Otto')))
    const names = (items: { name: string }[]) => items.map((item) => item.name)

    // Otto sees Cora's items and C's items only where D keeps them.
    assert.deepEqual(names(await listItemsOwnedBy(db, { userId: byName('Cora').id }, otto)), [
      'cora @ depot',
    ])
    const all = await listInventory(db, { scope: { everything: true }, page: 1, pageSize: 100 })
    const c = all.items.find((item) => item.name === 'c @ local')
    if (!c) throw new Error('seed failed')
    // C's local holds "otto @ local": Otto may see the place, though he does not manage it.
    assert.equal(await locationShowsItemTo(db, c.locationId, otto), true)
  })
})
