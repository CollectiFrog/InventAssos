// Review F7: IDs and page numbers come from the URL; bad ones are "not found", never a 500.
import * as assert from 'remix/assert'
import type { Database } from 'remix/data-table'
import { after, before, describe, it } from 'remix/test'

import { createTestApp, type TestApp, type TestClient } from '../../test/app.ts'
import { signIn } from '../../test/auth.ts'
import { openTestDatabase, resetDatabase } from '../../test/database.ts'
import { createActiveUser } from '../../test/users.ts'
import { routes } from '../routes.ts'

describe('malformed IDs and page numbers (review F7)', () => {
  let db: Database
  let app: TestApp
  let admin: TestClient

  before(async () => {
    db = await openTestDatabase()
    await resetDatabase(db)
    await createActiveUser(db, 'Admin', 'admin@example.org')
    app = createTestApp(db, { adminEmails: ['admin@example.org'] })
    admin = app.client()
    await signIn(app, admin, 'admin@example.org')
  })
  after(async () => {
    await db.close()
  })

  it('answers 404 to pages whose ID is not a UUID', async () => {
    const bad = "not-a-uuid'"
    for (const path of [
      routes.items.show.href({ itemId: bad }),
      routes.items.edit.index.href({ itemId: bad }),
      routes.items.move.index.href({ itemId: bad }),
      routes.items.archive.index.href({ itemId: bad }),
      routes.locations.show.href({ locationId: bad }),
      routes.locations.edit.index.href({ locationId: bad }),
      routes.people.show.href({ userId: bad }),
    ]) {
      assert.equal((await admin.get(path)).status, 404, path)
    }
  })

  it('treats a malformed ID in a form post as unknown, without a server error', async () => {
    const bad = 'xyz'
    for (const path of [
      routes.items.edit.action.href({ itemId: bad }),
      routes.items.contact.href({ itemId: bad }),
      routes.locations.remove.href({ locationId: bad }),
      routes.admin.disableAccount.href({ userId: bad }),
      routes.admin.collectifs.approve.href({ collectifId: bad }),
      routes.admin.responsibles.remove.href({ collectifId: bad, userId: bad }),
    ]) {
      const response = await admin.post(path, { message: 'x', locationId: bad })
      assert.ok(response.status < 500, `${path} → ${response.status}`)
    }
  })

  it('caps the page number of the inventory', async () => {
    const huge = `${routes.inventory.index.href()}?page=99999999999999999999999`
    assert.equal((await admin.get(huge)).status, 200)
  })
})
