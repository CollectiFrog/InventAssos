import * as assert from 'remix/assert'
import type { Database } from 'remix/data-table'
import { after, before, describe, it } from 'remix/test'

import { openTestDatabase } from '../../../test/database.ts'
import { get } from '../../../test/http.ts'
import { openDatabase } from '../../db.ts'
import { createAppRouter } from '../../router.ts'
import { routes } from '../../routes.ts'

describe('health probes', () => {
  let db: Database
  // Nothing listens on port 1: every query fails with ECONNREFUSED.
  let unreachable: Database

  before(async () => {
    db = await openTestDatabase()
    unreachable = openDatabase('postgres://nobody:nobody@127.0.0.1:1/nothing')
  })

  after(async () => {
    await db.close()
    await unreachable.close()
  })

  it('liveness answers 200 without querying the database', async () => {
    const router = createAppRouter({ db: unreachable })
    const response = await router.fetch(get(routes.health.live.href()))

    assert.equal(response.status, 200)
    assert.equal(response.headers.get('Cache-Control'), 'no-store')
    assert.deepEqual(await response.json(), { status: 'ok' })
  })

  it('readiness answers 200 when the database answers', async () => {
    const router = createAppRouter({ db })
    const response = await router.fetch(get(routes.health.ready.href()))

    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { status: 'ok', database: 'ok' })
  })

  it('readiness answers 503 when the database is unreachable', async () => {
    const router = createAppRouter({ db: unreachable })
    const response = await router.fetch(get(routes.health.ready.href()))

    assert.equal(response.status, 503)
    assert.deepEqual(await response.json(), { status: 'unavailable', database: 'unavailable' })
  })
})
