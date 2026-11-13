import * as assert from 'remix/assert'
import { type Database, sql } from 'remix/data-table'
import { after, before, beforeEach, describe, it } from 'remix/test'

import { createTestApp, type TestApp, type TestClient } from '../../../test/app.ts'
import { signIn } from '../../../test/auth.ts'
import { createActiveCollectif } from '../../../test/collectifs.ts'
import { openTestDatabase, resetDatabase } from '../../../test/database.ts'
import { csvFile, importIdOf, uploadFile } from '../../../test/imports.ts'
import { createTestLocation } from '../../../test/locations.ts'
import { createActiveUser } from '../../../test/users.ts'
import { findImport } from '../../data/imports.ts'
import { decideMembership, requestMembership } from '../../data/members.ts'
import type { Collectif, Location, User } from '../../data/tables.ts'
import { purgeExpiredData } from '../../maintenance.ts'
import { routes } from '../../routes.ts'
import { inventoryHeaderRow } from './format.ts'

describe('import, steps 1 and 2: the file and its columns (US-0.10.1)', () => {
  let db: Database
  let app: TestApp
  let rita: User
  let frog: Collectif
  let local: Location
  let ritaClient: TestClient

  before(async () => {
    db = await openTestDatabase()
  })
  beforeEach(async () => {
    await resetDatabase(db)
    rita = await createActiveUser(db, 'Rita', 'rita@example.org')
    frog = await createActiveCollectif(db, "Collecti'FROG", rita.id)
    local = await createTestLocation(db, { collectifId: frog.id }, 'Local')
    app = createTestApp(db)
    ritaClient = app.client()
    await signIn(app, ritaClient, 'rita@example.org')
  })
  after(async () => {
    await db.close()
  })

  const file = csvFile([
    ['Désignation', 'Qté', 'Famille', 'Remarques'],
    ['Lyre', '2', 'Lumière', ''],
    ['Console', '1', 'Son', 'Prêtée en juin'],
  ])

  it('offers the locations one manages, preselected from the collectif', async () => {
    const page = await ritaClient.get(
      `${routes.imports.start.index.href()}?pour=collectif:${frog.id}`,
    )
    assert.match(page.text, new RegExp(`<option value="${local.id}" selected>Local · `))
    assert.match(page.text, /enctype="multipart\/form-data"/i)
  })

  it('stores the file and guesses its columns', async () => {
    const response = await uploadFile(ritaClient, local.id, file)
    assert.equal(response.status, 303)
    const importId = importIdOf(response.location)
    const pending = await findImport(db, importId, rita.id)
    assert.equal(pending?.rows.length, 2)
    assert.deepEqual(
      pending?.rows.map((row) => row.n),
      [2, 3],
    )
    assert.deepEqual(pending?.columnMapping, ['name', 'quantity', 'category', 'description'])
    // Every title and every category was recognised: straight to the preview.
    assert.equal(response.location, routes.imports.preview.index.href({ importId }))
    const page = (await ritaClient.get(routes.imports.columns.index.href({ importId }))).text
    assert.match(page, /Lyre · Console/)
    assert.match(page, /<option value="name" selected>Nom<\/option>/)
    assert.match(page, /fichier gardé jusqu’à \d{1,2} h \d{2}/)
  })

  it('maps every column of our own export', async () => {
    const response = await uploadFile(
      ritaClient,
      local.id,
      csvFile([
        inventoryHeaderRow(),
        ['R-1', 'Lyre', 'Lumière', '1', '', '', '', '', '', '', '', ''],
      ]),
    )
    const pending = await findImport(db, importIdOf(response.location), rita.id)
    assert.equal(pending?.columnMapping.filter((field) => field !== null).length, 12)
  })

  it('explains why a file is refused, keeping the location', async () => {
    const cases: [File, RegExp][] = [
      [new File([new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2])], 'a.xlsx'), /C’est un classeur/],
      [new File([new Uint8Array([0xff, 0xfe, 0x41, 0])], 'a.csv'), /UTF-16/],
      [csvFile([['Nom']]), /aucune ligne à importer/],
      [new File(['Nom\n"jamais fermé'], 'a.csv'), /guillemet n’est pas fermé/],
      [csvFile([Array.from({ length: 51 }, (_, i) => `C${i}`), ['x']]), /trop de colonnes/],
      [new File([''], 'vide.csv'), /Choisissez un fichier CSV/],
    ]
    for (const [refused, message] of cases) {
      const response = await uploadFile(ritaClient, local.id, refused)
      assert.equal(response.status, 400, String(message))
      assert.match(response.text, message)
      assert.match(response.text, new RegExp(`<option value="${local.id}" selected>`))
    }
    const n = await db.exec(sql`select count(*)::int as n from imports`)
    assert.equal(n.rows?.[0]?.n, 0)
  })

  it('refuses more than 2,000 rows', async () => {
    const rows = [['Nom'], ...Array.from({ length: 2001 }, (_, i) => [`Objet ${i}`])]
    const response = await uploadFile(ritaClient, local.id, csvFile(rows))
    assert.equal(response.status, 400)
    assert.match(response.text, /trop de lignes : 2000 au plus/)
  })

  it('sends a file over 2 MB back to step 1 with an explanation', async () => {
    const big = new File(['x'.repeat(3 * 1024 * 1024)], 'gros.csv')
    const response = await uploadFile(ritaClient, local.id, big)
    assert.equal(response.status, 303)
    assert.equal(response.location, `${routes.imports.start.index.href()}?erreur=taille`)
    const page = (await ritaClient.get(response.location ?? '')).text
    assert.match(page, /Ce fichier dépasse 2 Mo/)
  })

  it('refuses a location one does not manage, and a member of the collectif', async () => {
    const sami = await createActiveUser(db, 'Sami', 'sami@example.org')
    await requestMembership(db, sami.id, frog.id)
    await decideMembership(db, {
      userId: sami.id,
      collectifId: frog.id,
      from: { status: 'pending' },
      status: 'active',
      decidedBy: rita.id,
    })
    const samiClient = app.client()
    await signIn(app, samiClient, 'sami@example.org')
    assert.equal((await uploadFile(samiClient, local.id, file)).status, 403)
    const samiHome = await createTestLocation(db, { userId: sami.id }, 'Chez Sami')
    assert.equal((await uploadFile(samiClient, samiHome.id, file)).status, 303)
    assert.equal((await uploadFile(ritaClient, samiHome.id, file)).status, 403)
  })

  it('keeps one import per person: a new file replaces the previous one', async () => {
    const first = importIdOf((await uploadFile(ritaClient, local.id, file)).location)
    const second = importIdOf((await uploadFile(ritaClient, local.id, file)).location)
    assert.notEqual(first, second)
    assert.equal(
      (await ritaClient.get(routes.imports.columns.index.href({ importId: first }))).status,
      404,
    )
  })

  it('answers the same 404 to someone else, an expired import and a malformed ID', async () => {
    const importId = importIdOf((await uploadFile(ritaClient, local.id, file)).location)
    const lou = await createActiveUser(db, 'Lou', 'lou@example.org')
    const louClient = app.client()
    await signIn(app, louClient, lou.email)
    const page = await louClient.get(routes.imports.columns.index.href({ importId }))
    assert.equal(page.status, 404)
    assert.match(page.text, /Import introuvable/)
    assert.equal(
      (await ritaClient.get(routes.imports.columns.index.href({ importId: 'x' }))).status,
      404,
    )
    await db.exec(sql`update imports set expires_at = now() - interval '1 second',
      created_at = now() - interval '1 hour'`)
    assert.equal(
      (await ritaClient.get(routes.imports.columns.index.href({ importId }))).status,
      404,
    )
    await purgeExpiredData(db)
    const n = await db.exec(sql`select count(*)::int as n from imports`)
    assert.equal(n.rows?.[0]?.n, 0)
  })

  it('checks the columns chosen, then saves them', async () => {
    const importId = importIdOf((await uploadFile(ritaClient, local.id, file)).location)
    const url = routes.imports.columns.action.href({ importId })
    const twice = await ritaClient.post(url, { 'col-0': 'name', 'col-1': 'name' })
    assert.equal(twice.status, 400)
    assert.match(twice.text, /« Nom » est déjà choisi pour « Désignation »/)
    const unknown = await ritaClient.post(url, { 'col-0': 'name', 'col-1': 'owner' })
    assert.match(unknown.text, /Choix inconnu/)
    const nothing = await ritaClient.post(url, { 'col-1': 'quantity' })
    assert.match(nothing.text, /Choisissez au moins la colonne du nom/)

    const saved = await ritaClient.post(url, { 'col-0': 'name', 'col-1': 'quantity' })
    assert.equal(saved.status, 303)
    const pending = await findImport(db, importId, rita.id)
    assert.deepEqual(pending?.columnMapping, ['name', 'quantity', null, null])
  })

  it('abandons an import: nothing is kept, back to the collectif', async () => {
    const importId = importIdOf((await uploadFile(ritaClient, local.id, file)).location)
    const response = await ritaClient.post(routes.imports.cancel.href({ importId }))
    assert.equal(response.location, routes.collectifs.show.href({ slug: frog.slug }))
    assert.equal(await findImport(db, importId, rita.id), null)
    const page = (await ritaClient.get(response.location ?? '')).text
    assert.match(page, /Import abandonné : rien n’a été ajouté/)
  })

  it('refuses a visitor’s file before reading it', async () => {
    const visitor = app.client()
    const body = new FormData()
    body.set('fichier', file)
    const response = await visitor.postForm(routes.imports.start.action.href(), body, {
      csrf: false,
    })
    assert.equal(response.status, 413)
  })
})
