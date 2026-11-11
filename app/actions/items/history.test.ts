import * as assert from 'remix/assert'
import { type Database, sql } from 'remix/data-table'
import { after, before, beforeEach, describe, it } from 'remix/test'

import { createTestApp } from '../../../test/app.ts'
import { signIn } from '../../../test/auth.ts'
import { createActiveCollectif } from '../../../test/collectifs.ts'
import { openTestDatabase, resetDatabase } from '../../../test/database.ts'
import { createTestItem, itemFormFields } from '../../../test/items.ts'
import { createTestLocation } from '../../../test/locations.ts'
import { createActiveUser } from '../../../test/users.ts'
import { setResponsible } from '../../data/responsibles.ts'
import { routes } from '../../routes.ts'

describe('item history (US-0.5.6)', () => {
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

  it('shows created, edited, moved and archived, with names resolved at display', async () => {
    const max = await createActiveUser(db, 'Maxime Zébulon', 'maxime.zebulon@example.org')
    const louUser = await createActiveUser(db, 'Lou', 'lou@example.org')
    // Lou shares a collectif with Maxime, so she sees his items (ADR 0021).
    const collectif = await createActiveCollectif(db, 'Les Grenouilles', max.id)
    await setResponsible(db, { userId: louUser.id, collectifId: collectif.id, status: 'active' })
    const garage = await createTestLocation(db, { userId: max.id }, 'Garage Zébulon')
    const cave = await createTestLocation(db, { userId: max.id }, 'Cave Zébulon')
    const app = createTestApp(db)
    const client = app.client()
    await signIn(app, client, 'maxime.zebulon@example.org')

    const created = await client.post(
      routes.items.create.action.href(),
      itemFormFields({ locationId: garage.id, owner: 'me', description: 'Rayé par Maxime' }),
    )
    const itemId = /\/materiel\/([0-9a-f-]{36})$/.exec(created.location ?? '')?.[1] ?? ''
    await client.post(
      routes.items.edit.action.href({ itemId }),
      itemFormFields({ name: 'Console de Maxime', quantity: '3' }),
    )
    await client.post(routes.items.move.action.href({ itemId }), { locationId: cave.id })

    const lou = app.client()
    await signIn(app, lou, 'lou@example.org')
    const page = (await lou.get(routes.items.show.href({ itemId }))).text
    assert.match(page, /Ajouté dans « Garage Zébulon »/)
    assert.match(page, /Modifié \(nom, quantité, description\)/)
    assert.match(page, /Déplacé de « Garage Zébulon » vers « Cave Zébulon »/)
    assert.match(page, /par Maxime Zébulon/)

    await client.post(routes.items.archive.action.href({ itemId }), { reason: 'sold' })
    const owner = (await client.get(routes.items.show.href({ itemId }))).text
    assert.match(owner, /Archivé \(vendu\)/)
  })

  it('never writes a name, e-mail or free text into the audit log', async () => {
    const max = await createActiveUser(db, 'Maxime Zébulon', 'maxime.zebulon@example.org')
    const garage = await createTestLocation(db, { userId: max.id }, 'Garage Zébulon')
    const app = createTestApp(db)
    const client = app.client()
    await signIn(app, client, 'maxime.zebulon@example.org')
    const created = await client.post(
      routes.items.create.action.href(),
      itemFormFields({ locationId: garage.id, owner: 'me', name: 'Console Zébulon' }),
    )
    const itemId = /\/materiel\/([0-9a-f-]{36})$/.exec(created.location ?? '')?.[1] ?? ''
    await client.post(
      routes.items.edit.action.href({ itemId }),
      itemFormFields({ name: 'Console Zébulon 2', description: 'Zébulon' }),
    )

    const rows = await db.exec(
      sql`select action, entity, entity_id, payload::text as p from audit_log`,
    )
    assert.ok((rows.rows?.length ?? 0) >= 2)
    assert.doesNotMatch(JSON.stringify(rows.rows), /Zébulon|zebulon|example\.org|Rennes/i)
  })

  it('never shows who contacted the owner, to anyone; the log keeps the IDs', async () => {
    const max = await createActiveUser(db, 'Max', 'max@example.org')
    const collectif = await createActiveCollectif(db, 'Les Grenouilles', max.id)
    for (const [name, email] of [
      ['Alice Contacteuse', 'alice@example.org'],
      ['Bob', 'bob@example.org'],
    ] as const) {
      const user = await createActiveUser(db, name, email)
      await setResponsible(db, { userId: user.id, collectifId: collectif.id, status: 'active' })
    }
    const garage = await createTestLocation(db, { userId: max.id }, 'Garage')
    const item = await createTestItem(db, {
      locationId: garage.id,
      owner: { userId: max.id },
      createdBy: max.id,
    })
    const app = createTestApp(db, { adminEmails: ['admin@example.org'] })
    const alice = app.client()
    await signIn(app, alice, 'alice@example.org')
    await alice.post(routes.items.contact.href({ itemId: item.id }), { message: 'Dispo samedi ?' })

    for (const email of ['bob@example.org', 'max@example.org', 'admin@example.org']) {
      const client = app.client()
      await signIn(app, client, email)
      const page = (await client.get(routes.items.show.href({ itemId: item.id }))).text
      assert.doesNotMatch(page, /item\.contacted|Alice/, `${email} sees the contact`)
    }
    const log = await db.exec(sql`select 1 from audit_log where action = 'item.contacted'`)
    assert.equal(log.rows?.length, 1)
  })
})
