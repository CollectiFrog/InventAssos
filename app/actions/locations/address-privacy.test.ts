import * as assert from 'remix/assert'
import type { Database } from 'remix/data-table'
import { after, before, beforeEach, describe, it } from 'remix/test'

import { createTestApp, type TestApp } from '../../../test/app.ts'
import { signIn } from '../../../test/auth.ts'
import { createActiveCollectif } from '../../../test/collectifs.ts'
import { openTestDatabase, resetDatabase } from '../../../test/database.ts'
import { createTestItem } from '../../../test/items.ts'
import { createTestLocation } from '../../../test/locations.ts'
import { createActiveUser } from '../../../test/users.ts'
import type { Collectif, Location } from '../../data/tables.ts'
import { routes } from '../../routes.ts'

// test/locations.ts gives every location this address and these notes.
const address = /12 rue Secrète/
const notes = /Code 1234/

describe('only the city is shown to others (US-0.4.3)', () => {
  let db: Database
  let app: TestApp
  let collectif: Collectif
  let collectifPlace: Location
  let homePlace: Location

  before(async () => {
    db = await openTestDatabase()
  })
  beforeEach(async () => {
    await resetDatabase(db)
    const rita = await createActiveUser(db, 'Rita', 'rita@example.org')
    const max = await createActiveUser(db, 'Max', 'max@example.org')
    const lou = await createActiveUser(db, 'Lou', 'lou@example.org')
    collectif = await createActiveCollectif(db, 'Les Grenouilles', rita.id)
    collectifPlace = await createTestLocation(db, { collectifId: collectif.id }, 'Local')
    homePlace = await createTestLocation(db, { userId: max.id }, 'Garage de Max')
    // Lou keeps an item in each place, so she sees both pages (ADR 0021), city only.
    for (const place of [collectifPlace, homePlace]) {
      await createTestItem(db, {
        locationId: place.id,
        owner: { userId: lou.id },
        createdBy: lou.id,
      })
    }
    app = createTestApp(db, { adminEmails: ['boss@example.org'] })
  })
  after(async () => {
    await db.close()
  })

  async function pagesSeenBy(email: string): Promise<string[]> {
    const client = app.client()
    await signIn(app, client, email)
    const pages = [
      routes.collectifs.show.href({ slug: collectif.slug }),
      routes.locations.show.href({ locationId: collectifPlace.id }),
      routes.locations.show.href({ locationId: homePlace.id }),
      routes.locations.index.href(),
    ]
    return Promise.all(pages.map(async (path) => (await client.get(path)).text))
  }

  it('never sends the address or notes to a validated user who manages neither place', async () => {
    const pages = await pagesSeenBy('lou@example.org')
    const [, collectifShow, homeShow] = pages
    const html = pages.join('\n')

    assert.match(collectifShow ?? '', /Rennes/)
    assert.match(homeShow ?? '', /Rennes/)
    assert.doesNotMatch(html, address)
    assert.doesNotMatch(html, notes)
  })

  it("shows the collectif place's address to its responsible only", async () => {
    const [collectifPage, collectifShow, homeShow] = await pagesSeenBy('rita@example.org')

    assert.match(collectifPage ?? '', address)
    assert.match(collectifShow ?? '', notes)
    assert.doesNotMatch(homeShow ?? '', address)
  })

  it("shows a personal place's address to its owner only", async () => {
    const [, collectifShow, homeShow] = await pagesSeenBy('max@example.org')

    assert.match(homeShow ?? '', address)
    assert.doesNotMatch(collectifShow ?? '', address)
  })

  it('shows every address to the platform admin', async () => {
    const [collectifPage, collectifShow, homeShow] = await pagesSeenBy('boss@example.org')

    assert.match(collectifPage ?? '', address)
    assert.match(collectifShow ?? '', address)
    assert.match(homeShow ?? '', address)
  })
})
