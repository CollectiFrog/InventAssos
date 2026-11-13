import * as assert from 'remix/assert'
import { type Database, sql } from 'remix/data-table'
import { after, before, beforeEach, describe, it } from 'remix/test'

import { createTestApp, type TestApp, type TestClient } from '../../../test/app.ts'
import { signIn } from '../../../test/auth.ts'
import { createActiveCollectif } from '../../../test/collectifs.ts'
import { openTestDatabase, resetDatabase } from '../../../test/database.ts'
import { csvFile, importIdOf, uploadFile } from '../../../test/imports.ts'
import { createTestItem } from '../../../test/items.ts'
import { createTestLocation } from '../../../test/locations.ts'
import { createActiveUser } from '../../../test/users.ts'
import { decodeCsv, parseCsv } from '../../csv.ts'
import { findImport } from '../../data/imports.ts'
import { archiveItem, findItemById } from '../../data/items.ts'
import type { Collectif, Item, Location, User } from '../../data/tables.ts'
import { routes } from '../../routes.ts'
import { inventoryHeaderRow } from './format.ts'

describe('import, step 4: preview and confirmation (US-0.10.1 to US-0.10.3, ADR 0027)', () => {
  let db: Database
  let app: TestApp
  let rita: User
  let frog: Collectif
  let local: Location
  let amp: Item
  let client: TestClient

  before(async () => {
    db = await openTestDatabase()
  })
  beforeEach(async () => {
    await resetDatabase(db)
    rita = await createActiveUser(db, 'Rita', 'rita@example.org')
    frog = await createActiveCollectif(db, "Collecti'FROG", rita.id)
    local = await createTestLocation(db, { collectifId: frog.id }, 'Local')
    amp = await createTestItem(db, {
      locationId: local.id,
      owner: { collectifId: frog.id },
      createdBy: rita.id,
      name: 'Ampli',
      ref: 'AMP-01',
    })
    app = createTestApp(db)
    client = app.client()
    await signIn(app, client, 'rita@example.org')
  })
  after(async () => {
    await db.close()
  })

  /** Uploads a file in our export's format, which goes straight to the preview. */
  async function upload(rows: string[][]) {
    const response = await uploadFile(client, local.id, csvFile([inventoryHeaderRow(), ...rows]))
    return { response, importId: importIdOf(response.location) }
  }
  /** A row of our export format from named cells. */
  const row = (cells: { ref?: string; name?: string; quantity?: string; id?: string }) => [
    cells.ref ?? '',
    cells.name ?? '',
    'Son',
    cells.quantity ?? '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    cells.id ?? '',
  ]

  async function confirm(importId: string) {
    const page = (await client.get(routes.imports.preview.index.href({ importId }))).text
    const plan = /name="plan" value="([^"]+)"/.exec(page)?.[1] ?? ''
    return client.post(routes.imports.preview.action.href({ importId }), {
      intent: 'confirmer',
      plan,
    })
  }

  it('goes straight to the preview for our own format, with counts first', async () => {
    const { response, importId } = await upload([
      row({ name: 'Lyre', quantity: '2' }),
      row({ ref: 'AMP-01', quantity: '3' }),
    ])
    assert.equal(response.location, routes.imports.preview.index.href({ importId }))
    const page = (await client.get(response.location ?? '')).text
    assert.match(page, /<strong>1<\/strong> à créer · <strong>1<\/strong>\s*à modifier/)
    assert.match(page, /Importer 2 objets/)
  })

  it('creates and updates in one go, logs every change with the import, lands on the collectif', async () => {
    const { importId } = await upload([
      row({ name: 'Lyre', quantity: '2' }),
      row({ ref: 'amp-01', quantity: '3' }),
    ])
    const response = await confirm(importId)
    assert.equal(response.location, routes.collectifs.show.href({ slug: frog.slug }))
    assert.equal((await findItemById(db, amp.id))?.quantity, 3)
    const created = await db.exec(sql`select id, owner_collectif_id from items where name = 'Lyre'`)
    assert.equal(created.rows?.[0]?.owner_collectif_id, frog.id)
    const log = await db.exec(sql`select action, payload from audit_log
      where action in ('item.created', 'item.updated', 'import.confirmed') order by action`)
    assert.deepEqual(
      (log.rows ?? []).map((entry) => entry.action),
      ['import.confirmed', 'item.created', 'item.updated'],
    )
    assert.match(JSON.stringify(log.rows), new RegExp(`"importId":"${importId}"`))
    assert.doesNotMatch(JSON.stringify(log.rows), /Lyre|AMP/)
    assert.equal(await findImport(db, importId, rita.id), null)
    const page = (await client.get(response.location ?? '')).text
    assert.match(page, /Import terminé : 1 objet ajouté, 1 mis à jour/)
    const itemId = String(created.rows?.[0]?.id)
    const history = (await client.get(routes.items.show.href({ itemId }))).text
    assert.match(history, /Ajouté par un import dans/)
  })

  it('round-trips our own export: nothing to write the second time', async () => {
    const exported = await client.post(routes.exports.collectif.href({ slug: frog.slug }))
    const rows = parseCsv(decodeCsv(exported.bytes)).rows
    const response = await uploadFile(
      client,
      local.id,
      new File([new Uint8Array(exported.bytes)], 'export.csv', { type: 'text/csv' }),
    )
    const page = (await client.get(response.location ?? '')).text
    assert.equal(rows.length, 2)
    assert.match(page, /<strong>0<\/strong> à créer · <strong>0<\/strong>\s*à modifier/)
    assert.match(page, /Rien à importer : tout est déjà à jour/)
  })

  it('blocks everything while a row is invalid, and offers to send a corrected file', async () => {
    const { importId } = await upload([
      row({ name: 'Lyre' }),
      row({ name: 'Pied', quantity: 'deux' }),
    ])
    const page = (await client.get(routes.imports.preview.index.href({ importId }))).text
    assert.match(page, /1 ligne est à\s*corriger/)
    assert.match(page, /Quantité « deux »/)
    assert.doesNotMatch(page, /name="intent" value="confirmer"/)
    assert.match(page, /Envoyer le fichier corrigé/)
    const forced = await client.post(routes.imports.preview.action.href({ importId }), {
      intent: 'confirmer',
      plan: 'tout-autre-chose',
    })
    assert.equal(forced.status, 400)
    const n = await db.exec(sql`select count(*)::int as n from items where name = 'Lyre'`)
    assert.equal(n.rows?.[0]?.n, 0)
  })

  it('refuses a stale preview: the inventory changed meanwhile', async () => {
    const { importId } = await upload([row({ name: 'Lyre' })])
    const page = (await client.get(routes.imports.preview.index.href({ importId }))).text
    const plan = /name="plan" value="([^"]+)"/.exec(page)?.[1] ?? ''
    // Someone gives AMP-01 to the file's row in between: the plan is no longer the one shown.
    await db.exec(
      sql`update imports set rows = ${JSON.stringify([{ n: 2, c: row({ ref: 'AMP-01', quantity: '9' }) }])}::jsonb`,
    )
    const response = await client.post(routes.imports.preview.action.href({ importId }), {
      intent: 'confirmer',
      plan,
    })
    assert.equal(response.status, 409)
    assert.match(response.text, /L’inventaire a changé depuis cet aperçu/)
    assert.equal((await findItemById(db, amp.id))?.quantity, 1)
  })

  it('sets an archived item’s row aside, and adds it when the person asks', async () => {
    await archiveItem(db, amp.id, 'sold')
    const { importId } = await upload([
      row({ ref: 'AMP-01', name: 'Ampli' }),
      row({ name: 'Lyre' }),
    ])
    const page = (
      await client.get(`${routes.imports.preview.index.href({ importId })}?voir=archives`)
    ).text
    assert.match(page, /celle d’un objet archivé : la ligne n’est pas importée/)
    await client.post(routes.imports.preview.action.href({ importId }), {
      intent: 'forcer',
      ligne: '2',
    })
    assert.deepEqual((await findImport(db, importId, rita.id))?.forcedRows, [2])
    await confirm(importId)
    const amps = await db.exec(
      sql`select ref, archived_at from items where name = 'Ampli' order by created_at`,
    )
    assert.equal(amps.rows?.length, 2)
    assert.equal(
      amps.rows?.[1]?.ref,
      null,
      'the new item does not take the archived one’s reference',
    )
  })

  it('refuses a preview whose rows changed though the counts did not', async () => {
    const { importId } = await upload([row({ ref: 'AMP-01', quantity: '3' })])
    const page = (await client.get(routes.imports.preview.index.href({ importId }))).text
    const plan = /name="plan" value="([^"]+)"/.exec(page)?.[1] ?? ''
    // Still one update of the same item, but to another quantity: same counts, another plan.
    await db.exec(
      sql`update imports set rows = ${JSON.stringify([{ n: 2, c: row({ ref: 'AMP-01', quantity: '7' }) }])}::jsonb`,
    )
    const response = await client.post(routes.imports.preview.action.href({ importId }), {
      intent: 'confirmer',
      plan,
    })
    assert.equal(response.status, 409)
    assert.equal((await findItemById(db, amp.id))?.quantity, 1)
  })

  it('ignores an unknown view, inherited names included', async () => {
    const { importId } = await upload([row({ name: 'Lyre' })])
    for (const voir of ['constructor', '__proto__', 'toString', 'nimporte']) {
      const page = await client.get(
        `${routes.imports.preview.index.href({ importId })}?voir=${voir}`,
      )
      assert.equal(page.status, 200, voir)
    }
  })

  it('writes once even when confirmed twice', async () => {
    const { importId } = await upload([row({ name: 'Lyre' })])
    const first = await confirm(importId)
    assert.equal(first.status, 303)
    const again = await client.post(routes.imports.preview.action.href({ importId }), {
      intent: 'confirmer',
      plan: 'tout-autre-chose',
    })
    assert.equal(again.status, 404)
    const n = await db.exec(sql`select count(*)::int as n from items where name = 'Lyre'`)
    assert.equal(n.rows?.[0]?.n, 1)
  })

  it('imports into one’s own location, and lands on « Mon matériel »', async () => {
    const home = await createTestLocation(db, { userId: rita.id }, 'Garage')
    const response = await uploadFile(
      client,
      home.id,
      csvFile([inventoryHeaderRow(), row({ name: 'Perceuse' })]),
    )
    const importId = importIdOf(response.location)
    const done = await confirm(importId)
    assert.equal(done.location, routes.items.index.href())
    const owner = await db.exec(sql`select owner_user_id from items where name = 'Perceuse'`)
    assert.equal(owner.rows?.[0]?.owner_user_id, rita.id)
  })

  it('offers « Importer un fichier » to the collectif’s responsibles and in Mon matériel', async () => {
    const page = (await client.get(routes.collectifs.show.href({ slug: frog.slug }))).text
    assert.match(page, new RegExp(`href="/import\\?pour=collectif:${frog.id}"`))
    assert.match((await client.get(routes.items.index.href())).text, /href="\/import"/)
  })
})
