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
import { decodeCsv, parseCsv } from '../../csv.ts'
import { archiveItem } from '../../data/items.ts'
import { createLocation } from '../../data/locations.ts'
import { decideMembership, requestMembership } from '../../data/members.ts'
import type { Collectif } from '../../data/tables.ts'
import { setUserRole } from '../../data/users.ts'
import { routes } from '../../routes.ts'
import { inventoryHeaderRow } from '../imports/format.ts'

describe('export equipment as CSV (US-0.10.4)', () => {
  let db: Database
  let app: TestApp
  let frog: Collectif
  let rita: TestClient

  before(async () => {
    db = await openTestDatabase()
  })
  beforeEach(async () => {
    await resetDatabase(db)
    const ritaUser = await createActiveUser(db, 'Rita', 'rita@example.org')
    const paul = await createActiveUser(db, 'Paul', 'paul@example.org')
    const sami = await createActiveUser(db, 'Sami', 'sami@example.org')
    frog = await createActiveCollectif(db, "Collecti'FROG", ritaUser.id)
    await requestMembership(db, sami.id, frog.id)
    await decideMembership(db, {
      userId: sami.id,
      collectifId: frog.id,
      from: { status: 'pending' },
      status: 'active',
      decidedBy: ritaUser.id,
    })
    const local = await createLocation(
      db,
      { collectifId: frog.id },
      { name: 'Local', city: 'Rennes', address: '12 rue Secrète', notes: 'Code 4521' },
    )
    const ritaHome = await createTestLocation(db, { userId: ritaUser.id }, 'Garage')
    await createTestItem(db, {
      locationId: local.id,
      owner: { collectifId: frog.id },
      createdBy: ritaUser.id,
      name: 'Projecteur',
      ref: 'PRJ-1',
    })
    // Owned by the collectif, kept at Rita's: still in the collectif's export.
    await createTestItem(db, {
      locationId: ritaHome.id,
      owner: { collectifId: frog.id },
      createdBy: ritaUser.id,
      name: '=HYPERLINK("http://x","y")',
    })
    // Deposited by Paul in the local: his, not the collectif's.
    await createTestItem(db, {
      locationId: local.id,
      owner: { userId: paul.id },
      createdBy: ritaUser.id,
      name: 'Ampli de Paul',
    })
    const sold = await createTestItem(db, {
      locationId: local.id,
      owner: { collectifId: frog.id },
      createdBy: ritaUser.id,
      name: 'Vendu',
    })
    await archiveItem(db, sold.id, 'sold')
    app = createTestApp(db)
    rita = app.client()
    await signIn(app, rita, 'rita@example.org')
  })
  after(async () => {
    await db.close()
  })

  const exportFrog = (client: TestClient) =>
    client.post(routes.exports.collectif.href({ slug: frog.slug }))

  it("sends the collectif's active items as a CSV the import format reads", async () => {
    const response = await exportFrog(rita)
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('Content-Type'), 'text/csv; charset=utf-8')
    assert.deepEqual([...response.bytes.slice(0, 3)], [0xef, 0xbb, 0xbf], 'a UTF-8 BOM')
    assert.equal(response.headers.get('Cache-Control'), 'no-store')
    assert.match(
      response.headers.get('Content-Disposition') ?? '',
      /^attachment; filename="inventaire-collecti-frog-\d{4}-\d{2}-\d{2}\.csv"$/,
    )
    const rows = parseCsv(decodeCsv(new TextEncoder().encode(response.text))).rows
    assert.deepEqual(rows[0], inventoryHeaderRow())
    const names = rows.slice(1).map((row) => row[1])
    assert.deepEqual(names, ['\'=HYPERLINK("http://x","y")', 'Projecteur'])
    assert.equal(rows[2]?.[0], 'PRJ-1')
    assert.equal(rows[2]?.[10], 'Local')
  })

  it('never writes an address, notes or a person', async () => {
    const text = (await exportFrog(rita)).text
    assert.doesNotMatch(text, /Secrète|4521|Rennes|Paul|Rita|@example/)
  })

  it('logs the export with its count only', async () => {
    await exportFrog(rita)
    const log = await db.exec(sql`select entity, entity_id, payload from audit_log
      where action = 'inventory.exported'`)
    assert.equal(log.rows?.[0]?.entity, 'collectif')
    assert.equal(log.rows?.[0]?.entity_id, frog.id)
    assert.match(JSON.stringify(log.rows?.[0]?.payload), /"items":2/)
  })

  it('refuses a member (403) and an outsider (404)', async () => {
    const sami = app.client()
    await signIn(app, sami, 'sami@example.org')
    assert.equal((await exportFrog(sami)).status, 403)
    const paul = app.client()
    await signIn(app, paul, 'paul@example.org')
    assert.equal((await exportFrog(paul)).status, 404)
  })

  it('lets an admin export any collectif, and refuses a moderator', async () => {
    await createActiveUser(db, 'Boss', 'boss@example.org')
    const mona = await createActiveUser(db, 'Mona', 'mona@example.org')
    await setUserRole(db, mona.id, 'moderator')
    const staffApp = createTestApp(db, { adminEmails: ['boss@example.org'] })
    const boss = staffApp.client()
    await signIn(staffApp, boss, 'boss@example.org')
    assert.equal((await exportFrog(boss)).status, 200)
    const moderator = staffApp.client()
    await signIn(staffApp, moderator, 'mona@example.org')
    assert.equal((await exportFrog(moderator)).status, 403)
  })

  it('tells a visitor nothing about which collectifs exist', async () => {
    const visitor = app.client()
    const existing = await visitor.post(routes.exports.collectif.href({ slug: frog.slug }))
    const missing = await visitor.post(routes.exports.collectif.href({ slug: 'nexiste-pas' }))
    assert.equal(existing.status, 303)
    assert.equal(missing.status, existing.status)
    assert.equal(missing.location, existing.location)
  })

  it('refuses a post from another origin', async () => {
    const response = await rita.postRaw(routes.exports.mine.href(), new URLSearchParams(), {
      Origin: 'https://evil.example',
      'Content-Type': 'application/x-www-form-urlencoded',
    })
    assert.equal(response.status, 403)
  })

  it("exports one's own equipment, wherever it is stored", async () => {
    const paul = app.client()
    await signIn(app, paul, 'paul@example.org')
    const response = await paul.post(routes.exports.mine.href())
    assert.equal(response.status, 200)
    assert.match(response.headers.get('Content-Disposition') ?? '', /filename="mon-materiel-/)
    const rows = parseCsv(decodeCsv(new TextEncoder().encode(response.text))).rows
    assert.deepEqual(
      rows.slice(1).map((row) => row[1]),
      ['Ampli de Paul'],
    )
  })

  it('refuses without the CSRF token, and above the hourly limit', async () => {
    const forged = await rita.post(
      routes.exports.collectif.href({ slug: frog.slug }),
      {},
      {
        csrf: false,
      },
    )
    assert.equal(forged.status, 403)
    const limited = createTestApp(db, {
      rateLimits: {
        mailsPerAddress: { limit: 100, windowSeconds: 60 },
        formsPerClient: { limit: 100, windowSeconds: 60 },
        requestsPerUser: { limit: 100, windowSeconds: 60 },
        contactsPerUser: { limit: 100, windowSeconds: 60 },
        adminNotifications: { limit: 100, windowSeconds: 60 },
        exportsPerUser: { limit: 1, windowSeconds: 60 },
        uploadsPerUser: { limit: 100, windowSeconds: 60 },
      },
    })
    const client = limited.client()
    await signIn(limited, client, 'rita@example.org')
    assert.equal((await client.post(routes.exports.mine.href())).status, 200)
    assert.equal((await client.post(routes.exports.mine.href())).status, 429)
  })

  it('offers the export button to responsibles only', async () => {
    const page = (await rita.get(routes.collectifs.show.href({ slug: frog.slug }))).text
    assert.match(page, /Exporter \(CSV\)/)
    const sami = app.client()
    await signIn(app, sami, 'sami@example.org')
    const memberPage = (await sami.get(routes.collectifs.show.href({ slug: frog.slug }))).text
    assert.doesNotMatch(memberPage, /Exporter \(CSV\)/)
    assert.match(
      (await sami.get(routes.items.index.href())).text,
      /Exporter le matériel qui m’appartient/,
    )
  })
})
