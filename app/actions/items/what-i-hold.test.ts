import * as assert from 'remix/assert'
import type { Database } from 'remix/data-table'
import { after, before, beforeEach, describe, it } from 'remix/test'

import { createTestApp, type TestApp, type TestClient } from '../../../test/app.ts'
import { signIn } from '../../../test/auth.ts'
import { createActiveCollectif } from '../../../test/collectifs.ts'
import { openTestDatabase, resetDatabase } from '../../../test/database.ts'
import { createTestItem } from '../../../test/items.ts'
import { createTestLocation } from '../../../test/locations.ts'
import { createActiveUser } from '../../../test/users.ts'
import { routes } from '../../routes.ts'

/** Item names under one heading of Mon matériel. */
function section(html: string, title: string): string[] {
  const part = html.split('<section ').find((s) => s.includes(`>${title} · `)) ?? ''
  return [...part.matchAll(/<strong>(.*?)<\/strong>/g)].map((m) => m[1] ?? '')
}

describe('Mon matériel: what I hold (US-0.7.3)', () => {
  let db: Database
  let app: TestApp
  let rita: TestClient

  before(async () => {
    db = await openTestDatabase()
  })
  beforeEach(async () => {
    await resetDatabase(db)
    const ritaUser = await createActiveUser(db, 'Rita', 'rita@example.org')
    const max = await createActiveUser(db, 'Max', 'max@example.org')
    await createActiveUser(db, 'Lou', 'lou@example.org')
    const frog = await createActiveCollectif(db, "Collecti'FROG", ritaUser.id)
    const garage = await createTestLocation(db, { userId: ritaUser.id }, 'Garage de Rita')
    const local = await createTestLocation(db, { collectifId: frog.id }, 'Local du FROG')
    const add = (
      name: string,
      locationId: string,
      owner: { userId: string } | { collectifId: string },
    ) => createTestItem(db, { locationId, owner, createdBy: ritaUser.id, name })
    await add('Perceuse de Rita', garage.id, { userId: ritaUser.id })
    await add('Barnum du FROG', garage.id, { collectifId: frog.id })
    await add('Ampli de Max', garage.id, { userId: max.id })
    await add('Scie de Rita au local', local.id, { userId: ritaUser.id })
    await add('Console du FROG au local', local.id, { collectifId: frog.id })
    app = createTestApp(db)
    rita = app.client()
    await signIn(app, rita, 'rita@example.org')
  })
  after(async () => {
    await db.close()
  })

  it('lists what is stored at my places, by owner: mine, my collectifs’, borrowed', async () => {
    const html = (await rita.get(routes.items.index.href())).text
    assert.deepEqual(section(html, 'À moi'), ['Perceuse de Rita'])
    assert.deepEqual(section(html, 'À mes collectifs'), ['Barnum du FROG'])
    assert.deepEqual(section(html, 'Prêté par d’autres'), ['Ampli de Max'])
  })

  it('leaves out what is stored elsewhere, even when I own it', async () => {
    const html = (await rita.get(routes.items.index.href())).text
    assert.doesNotMatch(html, /Scie de Rita au local|Console du FROG au local/)
  })

  it('offers to add equipment when nothing is stored at my places', async () => {
    const lou = app.client()
    await signIn(app, lou, 'lou@example.org')
    const html = (await lou.get(routes.items.index.href())).text
    assert.match(html, /Rien n’est rangé chez vous pour l’instant/)
    assert.match(html, /<a href="\/materiel\/nouveau" class="button">Ajouter du matériel<\/a>/)
  })

  it('lists only my own locations in the Lieux tab', async () => {
    const html = (await rita.get(routes.locations.index.href())).text
    assert.match(html, /<strong>Garage de Rita<\/strong>/)
    assert.doesNotMatch(html, /<strong>Local du FROG<\/strong>/)
  })
})
