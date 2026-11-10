import * as assert from 'remix/assert'
import type { Database } from 'remix/data-table'
import { after, before, beforeEach, describe, it } from 'remix/test'

import { createTestApp, type TestApp } from '../../../../test/app.ts'
import { signIn } from '../../../../test/auth.ts'
import { createActiveCollectif } from '../../../../test/collectifs.ts'
import { openTestDatabase, resetDatabase } from '../../../../test/database.ts'
import { createTestItem, itemFormFields } from '../../../../test/items.ts'
import { createTestLocation } from '../../../../test/locations.ts'
import { createActiveUser } from '../../../../test/users.ts'
import { listEntityHistory } from '../../../data/audit-log.ts'
import { findItemById } from '../../../data/items.ts'
import type { Item } from '../../../data/tables.ts'
import { routes } from '../../../routes.ts'

describe('edit an item (US-0.5.3)', () => {
  let db: Database
  let app: TestApp
  // Max's item deposited at the Grenouilles' local, and a Grenouilles item kept in Max's garage.
  let deposited: Item
  let lent: Item

  before(async () => {
    db = await openTestDatabase()
  })
  beforeEach(async () => {
    await resetDatabase(db)
    const rita = await createActiveUser(db, 'Rita', 'rita@example.org')
    const otto = await createActiveUser(db, 'Otto', 'otto@example.org')
    const max = await createActiveUser(db, 'Max', 'max@example.org')
    await createActiveUser(db, 'Lou', 'lou@example.org')
    const grenouilles = await createActiveCollectif(db, 'Les Grenouilles', rita.id)
    await createActiveCollectif(db, 'Les Crapauds', otto.id)
    const local = await createTestLocation(db, { collectifId: grenouilles.id }, 'Local')
    const garage = await createTestLocation(db, { userId: max.id }, 'Garage')
    deposited = await createTestItem(db, {
      locationId: local.id,
      owner: { userId: max.id },
      createdBy: rita.id,
      name: 'Ampli de Max',
    })
    lent = await createTestItem(db, {
      locationId: garage.id,
      owner: { collectifId: grenouilles.id },
      createdBy: rita.id,
      name: 'Projecteur du collectif',
    })
    app = createTestApp(db, { adminEmails: ['boss@example.org'] })
  })
  after(async () => {
    await db.close()
  })

  async function edit(email: string, item: Item, name: string) {
    const client = app.client()
    await signIn(app, client, email)
    return client.post(routes.items.edit.action.href({ itemId: item.id }), itemFormFields({ name }))
  }

  const allowed: [string, () => Item, string][] = [
    ['the person who owns it, even stored at a collectif', () => deposited, 'max@example.org'],
    [
      'a responsible of the collectif whose location stores it',
      () => deposited,
      'rita@example.org',
    ],
    ['a responsible of the collectif that owns it', () => lent, 'rita@example.org'],
    ['the person whose location stores it', () => lent, 'max@example.org'],
    ['the platform admin', () => deposited, 'boss@example.org'],
  ]
  for (const [who, item, email] of allowed) {
    it(`lets ${who} edit it`, async () => {
      const response = await edit(email, item(), 'Renommé')
      assert.equal(response.status, 303)
      assert.equal((await findItemById(db, item().id))?.name, 'Renommé')
    })
  }

  const refused: [string, () => Item, string][] = [
    ['a responsible of another collectif', () => deposited, 'otto@example.org'],
    ['a validated user with no link to the deposited item', () => deposited, 'lou@example.org'],
    ['a validated user with no link to the lent item', () => lent, 'lou@example.org'],
  ]
  for (const [who, item, email] of refused) {
    it(`refuses ${who} (403)`, async () => {
      const response = await edit(email, item(), 'Volé')
      assert.equal(response.status, 403)
      assert.notEqual((await findItemById(db, item().id))?.name, 'Volé')
    })
  }

  it('logs the names of the changed fields, never their values', async () => {
    await edit('max@example.org', deposited, 'Ampli Fender')

    const entries = await listEntityHistory(db, 'item', deposited.id)
    const last = entries.at(-1)
    assert.equal(last?.action, 'item.updated')
    assert.match(JSON.stringify(last?.payload), /name/)
    assert.doesNotMatch(JSON.stringify(last), /Fender/)
  })

  it('shows the edit button only to those who may edit', async () => {
    const page = async (email: string) => {
      const client = app.client()
      await signIn(app, client, email)
      return (await client.get(routes.items.show.href({ itemId: deposited.id }))).text
    }
    assert.match(await page('max@example.org'), /\/modifier"/)
    assert.doesNotMatch(await page('lou@example.org'), /\/modifier"/)
  })
})
