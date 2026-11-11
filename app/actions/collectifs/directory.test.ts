import { readFile } from 'node:fs/promises'

import * as assert from 'remix/assert'
import { type Database, rawSql, sql } from 'remix/data-table'
import { after, before, beforeEach, describe, it } from 'remix/test'

import { createTestApp, type TestClient } from '../../../test/app.ts'
import { signIn } from '../../../test/auth.ts'
import { createActiveCollectif, createPendingCollectif } from '../../../test/collectifs.ts'
import { openTestDatabase, resetDatabase } from '../../../test/database.ts'
import { createTestItem } from '../../../test/items.ts'
import { createTestLocation } from '../../../test/locations.ts'
import { createActiveUser } from '../../../test/users.ts'
import { findCollectifById } from '../../data/collectifs.ts'
import type { Collectif } from '../../data/tables.ts'
import { routes } from '../../routes.ts'

/** Names of the collectifs listed in one section of the directory, in order. */
function namesIn(html: string, heading: RegExp): string[] {
  const section = html.split(/<section /).find((part) => heading.test(part)) ?? ''
  return [...section.matchAll(/<a href="\/collectifs\/[^"]+"><strong>(.*?)<\/strong>/g)].map(
    (match) => match[1] ?? '',
  )
}

describe('collectifs directory (US-0.7.12)', () => {
  let db: Database
  let camille: TestClient
  let frog: Collectif

  before(async () => {
    db = await openTestDatabase()
  })
  beforeEach(async () => {
    await resetDatabase(db)
    const me = await createActiveUser(db, 'Camille', 'camille@example.org')
    const otto = await createActiveUser(db, 'Otto', 'otto@example.org')
    frog = await createActiveCollectif(db, "Collecti'FROG", me.id)
    const ondes = await createActiveCollectif(db, 'Ondes Courtes', otto.id)
    const atelier = await createActiveCollectif(db, 'Atelier Vélo', otto.id)
    await createPendingCollectif(db, 'Pas encore validé', otto.id)
    await db.exec(sql`update collectifs set city = 'Saint-Malo' where id = ${ondes.id}`)
    await db.exec(sql`update collectifs set city = 'Fougères' where id = ${atelier.id}`)
    await db.exec(
      sql`update collectifs set description = 'Radio associative' where id = ${ondes.id}`,
    )
    const studio = await createTestLocation(db, { collectifId: ondes.id }, 'Studio des Ondes')
    await createTestItem(db, {
      locationId: studio.id,
      owner: { collectifId: ondes.id },
      createdBy: otto.id,
      name: 'Micro des Ondes',
    })
    const app = createTestApp(db)
    camille = app.client()
    await signIn(app, camille, 'camille@example.org')
  })
  after(async () => {
    await db.close()
  })

  const directory = async (query = '') =>
    (
      await camille.get(
        `${routes.collectifs.index.href()}${query ? `?q=${encodeURIComponent(query)}` : ''}`,
      )
    ).text

  it('lists my collectifs first, then the other active ones with city and description', async () => {
    const html = await directory()
    assert.deepEqual(namesIn(html, /Mes collectifs<\/h2>/), ["Collecti'FROG"])
    assert.deepEqual(namesIn(html, /Autres collectifs · 2/), ['Atelier Vélo', 'Ondes Courtes'])
    assert.match(html, /Saint-Malo/)
    assert.match(html, /Radio associative/)
    assert.doesNotMatch(html, /Pas encore validé/)
  })

  it('shows no item, location or member of a collectif I do not belong to', async () => {
    const html = await directory()
    assert.doesNotMatch(html, /Micro des Ondes|Studio des Ondes|Otto/)
  })

  it('searches the others by name or city, ignoring case and accents', async () => {
    assert.deepEqual(namesIn(await directory('fougeres'), /Autres collectifs/), ['Atelier Vélo'])
    assert.deepEqual(namesIn(await directory('ONDES'), /Autres collectifs/), ['Ondes Courtes'])
    // My collectifs stay listed whatever the search.
    assert.deepEqual(namesIn(await directory('ondes'), /Mes collectifs<\/h2>/), ["Collecti'FROG"])

    const none = await directory('50%')
    assert.deepEqual(namesIn(none, /Autres collectifs/), [])
    assert.match(none, /Aucun collectif ne correspond à « 50% »/)
    assert.match(none, /<a href="\/collectifs">Tout afficher<\/a>/)
  })

  it('always offers to declare a collectif', async () => {
    assert.match(await directory('nothing'), /Votre association n’y est pas/)
    assert.match(await directory(), /href="\/collectifs\/nouveau"/)
  })

  it("shows a collectif's city on its page", async () => {
    await db.exec(sql`update collectifs set city = 'Rennes' where id = ${frog.id}`)
    const page = await camille.get(routes.collectifs.show.href({ slug: frog.slug }))
    assert.match(page.text, /<h1>Collecti'FROG<\/h1><p class="status">Rennes · 0 objet/)
  })
})

describe('migration 0010: city of existing collectifs', () => {
  let db: Database

  before(async () => {
    db = await openTestDatabase()
  })
  beforeEach(async () => {
    await resetDatabase(db)
  })
  after(async () => {
    await db.close()
  })

  it('takes the city of the oldest location, and leaves the others empty', async () => {
    const rita = await createActiveUser(db, 'Rita', 'rita@example.org')
    const withPlaces = await createActiveCollectif(db, 'Avec lieux', rita.id)
    const without = await createActiveCollectif(db, 'Sans lieu', rita.id)
    const first = await createTestLocation(db, { collectifId: withPlaces.id }, 'Premier')
    const second = await createTestLocation(db, { collectifId: withPlaces.id }, 'Second')
    await db.exec(sql`update locations set city = 'Vitré', created_at = now() - interval '1 day'
      where id = ${first.id}`)
    await db.exec(sql`update locations set city = 'Rennes' where id = ${second.id}`)
    await db.exec(sql`update collectifs set city = ''`)

    const file = await readFile(
      new URL('../../../db/migrations/0010_collectif_city/up.sql', import.meta.url),
      'utf8',
    )
    const update = file.slice(file.indexOf('update collectifs'))
    await db.exec(rawSql(update))

    assert.equal((await findCollectifById(db, withPlaces.id))?.city, 'Vitré')
    assert.equal((await findCollectifById(db, without.id))?.city, '')
  })
})
