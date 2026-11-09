import * as assert from 'remix/assert'
import { type Database, sql } from 'remix/data-table'
import { after, before, beforeEach, describe, it } from 'remix/test'

import { createTestApp, type TestApp, type TestClient } from '../../../test/app.ts'
import { signIn } from '../../../test/auth.ts'
import { createActiveCollectif } from '../../../test/collectifs.ts'
import { openTestDatabase, resetDatabase } from '../../../test/database.ts'
import { createTestItem } from '../../../test/items.ts'
import { createTestLocation } from '../../../test/locations.ts'
import { createActiveUser } from '../../../test/users.ts'
import { setResponsible } from '../../data/responsibles.ts'
import type { Item } from '../../data/tables.ts'
import { routes } from '../../routes.ts'

describe('item page and contact (US-0.6.3)', () => {
  let db: Database
  let app: TestApp
  let lou: TestClient
  let collectifItem: Item
  let personItem: Item

  before(async () => {
    db = await openTestDatabase()
  })
  beforeEach(async () => {
    await resetDatabase(db)
    const rita = await createActiveUser(db, 'Rita', 'rita@example.org')
    const max = await createActiveUser(db, 'Max', 'max.secret@example.org')
    await createActiveUser(db, 'Lou', 'lou@example.org')
    const collectif = await createActiveCollectif(db, 'Les Grenouilles', rita.id)
    const local = await createTestLocation(db, { collectifId: collectif.id }, 'Local')
    const garage = await createTestLocation(db, { userId: max.id }, 'Garage')
    collectifItem = await createTestItem(db, {
      locationId: local.id,
      owner: { collectifId: collectif.id },
      createdBy: rita.id,
      name: 'Console du collectif',
    })
    personItem = await createTestItem(db, {
      locationId: garage.id,
      owner: { userId: max.id },
      createdBy: max.id,
      name: 'Ampli de Max',
    })
    app = createTestApp(db)
    lou = app.client()
    await signIn(app, lou, 'lou@example.org')
    app.mailer.outbox.length = 0
  })
  after(async () => {
    await db.close()
  })

  const page = async (item: Item, client = lou) =>
    (await client.get(routes.items.show.href({ itemId: item.id }))).text

  it("shows the collectif's contact phone, or the person's phone, with the city", async () => {
    await db.exec(sql`update collectifs set contact_phone = '01 02 03 04 05'`)
    await db.exec(
      sql`update users set phone = '06 07 08 09 10' where email = 'max.secret@example.org'`,
    )

    const collectifPage = await page(collectifItem)
    assert.match(collectifPage, /Téléphone : <a href="tel:0102030405">01 02 03 04 05<\/a>/)
    assert.match(collectifPage, /Rennes/)
    assert.doesNotMatch(collectifPage, /Votre message/)
    assert.match(await page(personItem), /06 07 08 09 10/)
  })

  it('without a phone, says so and e-mails the owner without revealing their address', async () => {
    const html = await page(personItem)
    assert.match(html, /Pas de téléphone renseigné/)
    assert.doesNotMatch(html, /max\.secret@example\.org/)

    const response = await lou.post(routes.items.contact.href({ itemId: personItem.id }), {
      message: 'Je peux l’emprunter samedi ?',
    })
    assert.equal(response.location, routes.items.show.href({ itemId: personItem.id }))
    const [mail] = app.mailer.outbox
    assert.equal(mail?.to, 'max.secret@example.org')
    assert.equal(mail?.replyTo, 'lou@example.org')
    assert.match(mail?.text ?? '', /samedi/)
    assert.match(await page(personItem), /Message envoyé/)

    const log = await db.exec(
      sql`select payload::text as p from audit_log where action = 'item.contacted'`,
    )
    assert.equal(log.rows?.length, 1)
    assert.doesNotMatch(String(log.rows?.[0]?.p), /samedi/)
  })

  it("writes to the collectif's active responsibles when the collectif has no phone", async () => {
    await lou.post(routes.items.contact.href({ itemId: collectifItem.id }), { message: 'Bonjour' })
    assert.deepEqual(
      app.mailer.outbox.map((mail) => mail.to),
      ['rita@example.org'],
    )
  })

  it('sends one e-mail per responsible, so they never see each other’s address', async () => {
    const sam = await createActiveUser(db, 'Sam', 'sam@example.org')
    await setResponsible(db, {
      userId: sam.id,
      collectifId: String(collectifItem.owner_collectif_id),
      status: 'active',
    })
    await lou.post(routes.items.contact.href({ itemId: collectifItem.id }), { message: 'Bonjour' })
    const recipients = app.mailer.outbox.map((mail) => mail.to).sort()
    assert.deepEqual(recipients, ['rita@example.org', 'sam@example.org'])
  })

  it('no longer shows the phone of an owner whose account is disabled', async () => {
    await db.exec(
      sql`update users set phone = '06 07 08 09 10' where email = 'max.secret@example.org'`,
    )
    await db.exec(sql`update users set status = 'disabled' where email = 'max.secret@example.org'`)
    const html = await page(personItem)
    assert.doesNotMatch(html, /06 07 08 09 10/)
    assert.match(html, /Pas de téléphone renseigné/)
  })

  it('sends nothing for an empty message', async () => {
    await lou.post(routes.items.contact.href({ itemId: personItem.id }), { message: '   ' })
    assert.equal(app.mailer.outbox.length, 0)
  })

  it('shows no contact section to the owner', async () => {
    const max = app.client()
    await signIn(app, max, 'max.secret@example.org')
    assert.doesNotMatch(await page(personItem, max), /Contacter/)
  })
})
