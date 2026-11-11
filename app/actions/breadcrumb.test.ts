import * as assert from 'remix/assert'
import type { Database } from 'remix/data-table'
import { after, before, beforeEach, describe, it } from 'remix/test'

import { createTestApp, type TestClient, testOrigin } from '../../test/app.ts'
import { signIn } from '../../test/auth.ts'
import { createActiveCollectif } from '../../test/collectifs.ts'
import { openTestDatabase, resetDatabase } from '../../test/database.ts'
import { createTestItem } from '../../test/items.ts'
import { createTestLocation } from '../../test/locations.ts'
import { createActiveUser } from '../../test/users.ts'
import type { Item, Location } from '../data/tables.ts'
import { routes } from '../routes.ts'

/** The breadcrumb as "label href", the current page without href. */
function trail(html: string): string[] {
  const nav =
    /<nav aria-label="Fil d’Ariane" class="breadcrumb">(.*?)<\/nav>/s.exec(html)?.[1] ?? ''
  return [...nav.matchAll(/<li( aria-current="page")?>(?:<a href="([^"]+)"[^>]*>)?([^<]+)/g)].map(
    ([, , href, label]) => (href ? `${label} ${href}` : `${label}`),
  )
}

/** Where « Retour » goes. */
function back(html: string): string | undefined {
  return /<a href="([^"]+)" class="back-link">/.exec(html)?.[1]
}

describe('breadcrumb on computers, « Retour » on phones (US-0.7.13)', () => {
  let db: Database
  let rita: TestClient
  let deck: Item
  let garage: Location

  before(async () => {
    db = await openTestDatabase()
  })
  beforeEach(async () => {
    await resetDatabase(db)
    const ritaUser = await createActiveUser(db, 'Rita', 'rita@example.org')
    const frog = await createActiveCollectif(db, "Collecti'FROG", ritaUser.id)
    const local = await createTestLocation(db, { collectifId: frog.id }, 'Local')
    garage = await createTestLocation(db, { userId: ritaUser.id }, 'Garage')
    deck = await createTestItem(db, {
      locationId: local.id,
      owner: { collectifId: frog.id },
      createdBy: ritaUser.id,
      name: 'Console',
    })
    const app = createTestApp(db)
    rita = app.client()
    await signIn(app, rita, 'rita@example.org')
  })
  after(async () => {
    await db.close()
  })

  it("follows an item's owning collectif", async () => {
    const html = (await rita.get(routes.items.show.href({ itemId: deck.id }))).text
    assert.deepEqual(trail(html), [
      'Collectifs /collectifs',
      "Collecti'FROG /collectifs/collecti-frog",
      'Console',
    ])
  })

  it('places a personal location under Mon matériel › Lieux', async () => {
    const html = (await rita.get(routes.locations.show.href({ locationId: garage.id }))).text
    assert.deepEqual(trail(html), ['Mon matériel /materiel', 'Lieux /lieux', 'Garage'])
    assert.equal(back(html), '/lieux')
  })

  it('goes back to the previous page of this site, with its query', async () => {
    const url = routes.items.show.href({ itemId: deck.id })
    const fromSearch = await rita.get(url, { Referer: `${testOrigin}/inventaire?q=con&tri=ville` })
    assert.equal(back(fromSearch.text), '/inventaire?q=con&amp;tri=ville')
  })

  it('falls back to the parent page without a usable Referer', async () => {
    const url = routes.items.show.href({ itemId: deck.id })
    for (const referer of [
      undefined,
      'https://evil.example/inventaire',
      `${testOrigin}${url}`,
      `${testOrigin}//evil.example`,
    ]) {
      const html = (await rita.get(url, referer ? { Referer: referer } : {})).text
      assert.equal(back(html), '/collectifs/collecti-frog', String(referer))
    }
  })
})
