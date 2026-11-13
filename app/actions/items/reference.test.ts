import * as assert from 'remix/assert'
import type { Database } from 'remix/data-table'
import { after, before, beforeEach, describe, it } from 'remix/test'

import { createTestApp, type TestApp, type TestClient } from '../../../test/app.ts'
import { signIn } from '../../../test/auth.ts'
import { createActiveCollectif } from '../../../test/collectifs.ts'
import { openTestDatabase, resetDatabase } from '../../../test/database.ts'
import { createTestItem, itemFormFields } from '../../../test/items.ts'
import { createTestLocation } from '../../../test/locations.ts'
import { createActiveUser } from '../../../test/users.ts'
import { archiveItem, findItemById, isRefConflict, refTaken } from '../../data/items.ts'
import type { Collectif, Item, Location, User } from '../../data/tables.ts'
import { routes } from '../../routes.ts'

describe('item reference, unique per owner (US-0.10.3)', () => {
  let db: Database
  let app: TestApp
  let rita: User
  let frog: Collectif
  let local: Location
  let amp: Item
  let ritaClient: TestClient

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
    ritaClient = app.client()
    await signIn(app, ritaClient, 'rita@example.org')
  })
  after(async () => {
    await db.close()
  })

  const add = (fields: Record<string, string>) =>
    ritaClient.post(
      routes.items.create.action.href(),
      itemFormFields({ locationId: local.id, owner: `collectif:${frog.id}`, ...fields }),
    )

  it('compares references as the index does: case and accents ignored, per owner', async () => {
    const ofFrog = { collectifId: frog.id }
    assert.equal(await refTaken(db, ofFrog, 'amp-01'), true)
    assert.equal(await refTaken(db, ofFrog, 'AMP-02'), false)
    assert.equal(await refTaken(db, ofFrog, 'AMP-01', amp.id), false, 'the item itself')
    assert.equal(await refTaken(db, { userId: rita.id }, 'AMP-01'), false, 'another owner')
    await archiveItem(db, amp.id, 'sold')
    assert.equal(await refTaken(db, ofFrog, 'AMP-01'), true, 'archived items keep theirs')
  })

  it('lets the database refuse a duplicate, and recognises that refusal', async () => {
    const duplicate = createTestItem(db, {
      locationId: local.id,
      owner: { collectifId: frog.id },
      createdBy: rita.id,
      ref: 'Amp-01',
    })
    const error = await duplicate.then(
      () => null,
      (reason: unknown) => reason,
    )
    assert.ok(error !== null, 'the index must refuse it')
    assert.equal(isRefConflict(error), true)
    assert.equal(isRefConflict(new Error('other')), false)
  })

  it('keeps several items without reference', async () => {
    for (const name of ['Pied 1', 'Pied 2']) {
      assert.equal((await add({ name, ref: '' })).status, 303)
    }
  })

  it('stores a reference, shows it and finds the item by it', async () => {
    const response = await add({ name: 'Console', ref: '  CONS-7  ' })
    const itemId = /\/materiel\/([0-9a-f-]{36})$/.exec(response.location ?? '')?.[1] ?? ''
    assert.equal((await findItemById(db, itemId))?.ref, 'CONS-7')
    const page = (await ritaClient.get(routes.items.show.href({ itemId }))).text
    assert.match(page, /<dt>Référence<\/dt><dd>CONS-7<\/dd>/)
    const search = await ritaClient.get(`${routes.inventory.index.href()}?q=cons-7`)
    assert.match(search.text, /Console/)
  })

  it('refuses a reference the owner already uses, keeping what was typed', async () => {
    const response = await add({ name: 'Autre ampli', ref: 'amp-01' })
    assert.equal(response.status, 400)
    assert.match(response.text, /Un autre objet de ce propriétaire porte déjà cette référence/)
    assert.match(response.text, /value="Autre ampli"/)
  })

  it('accepts the same reference for another owner', async () => {
    const home = await createTestLocation(db, { userId: rita.id }, 'Chez Rita')
    const response = await ritaClient.post(
      routes.items.create.action.href(),
      itemFormFields({ locationId: home.id, owner: 'me', name: 'Mon ampli', ref: 'AMP-01' }),
    )
    assert.equal(response.status, 303)
  })

  it('keeps its own reference when edited, refuses another item’s, logs the change', async () => {
    const edit = (ref: string) =>
      ritaClient.post(
        routes.items.edit.action.href({ itemId: amp.id }),
        itemFormFields({ name: 'Ampli', ref }),
      )
    assert.equal((await edit('AMP-01')).status, 303)
    await createTestItem(db, {
      locationId: local.id,
      owner: { collectifId: frog.id },
      createdBy: rita.id,
      ref: 'AMP-02',
    })
    assert.equal((await edit('amp-02')).status, 400)
    assert.equal((await edit('AMP-10')).status, 303)
    assert.equal((await findItemById(db, amp.id))?.ref, 'AMP-10')
    const page = (await ritaClient.get(routes.items.show.href({ itemId: amp.id }))).text
    assert.match(page, /Modifié \([^)]*référence/)
  })

  it('refuses C1 control characters as a form error, not a server error', async () => {
    for (const ref of ['A\u0085B', 'AB\u009f']) {
      const response = await add({ name: 'Pied', ref })
      assert.equal(response.status, 400, JSON.stringify(ref))
      assert.match(response.text, /Une seule ligne/)
    }
  })

  it('stores NFC, so a reference typed on a Mac collides with the same one typed elsewhere', async () => {
    assert.equal((await add({ name: 'Été 1', ref: 'Été-1' })).status, 303)
    const decomposed = 'Été-1'.normalize('NFD')
    assert.notEqual(decomposed, 'Été-1')
    const response = await add({ name: 'Été 2', ref: decomposed })
    assert.equal(response.status, 400)
    assert.match(response.text, /porte déjà cette référence/)
  })

  it('lets only the owner set a reference: a deposit learns nothing of the person’s', async () => {
    const paul = await createActiveUser(db, 'Paul', 'paul@example.org')
    const paulHome = await createTestLocation(db, { userId: paul.id }, 'Chez Paul')
    await createTestItem(db, {
      locationId: paulHome.id,
      owner: { userId: paul.id },
      createdBy: paul.id,
      ref: 'SECRET-1',
    })
    const deposit = (ref: string) =>
      ritaClient.post(
        routes.items.create.action.href(),
        itemFormFields({
          locationId: local.id,
          owner: 'person',
          ownerEmail: 'paul@example.org',
          name: 'Dépôt',
          ref,
        }),
      )
    // The same answer whether Paul uses the reference or not.
    for (const ref of ['SECRET-1', 'LIBRE-9']) {
      const response = await deposit(ref)
      assert.equal(response.status, 400)
      assert.match(response.text, /Seul le propriétaire de l’objet choisit sa référence/)
    }
    const created = await deposit('')
    assert.equal(created.status, 303)
    const itemId = /\/materiel\/([0-9a-f-]{36})$/.exec(created.location ?? '')?.[1] ?? ''
    // Rita may still edit the deposit, but not give it a reference.
    const edit = (ref: string) =>
      ritaClient.post(
        routes.items.edit.action.href({ itemId }),
        itemFormFields({ name: 'Dépôt', ref }),
      )
    assert.equal((await edit('')).status, 303)
    const refused = await edit('SECRET-1')
    assert.equal(refused.status, 400)
    assert.match(refused.text, /Seul le propriétaire/)
  })

  it('answers a duplicate taken between the check and the write with the same message', async () => {
    // A database that slips a racer's item in just before the next transaction starts.
    let racerRef: string | null = null
    const racing = new Proxy(db, {
      get(target, property) {
        const value = Reflect.get(target, property, target)
        if (property !== 'transaction') {
          return typeof value === 'function' ? value.bind(target) : value
        }
        return async (run: (tx: Database) => Promise<unknown>) => {
          if (racerRef !== null) {
            const ref = racerRef
            racerRef = null
            await createTestItem(target, {
              locationId: local.id,
              owner: { collectifId: frog.id },
              createdBy: rita.id,
              ref,
            })
          }
          return target.transaction(run)
        }
      },
    })
    const raceApp = createTestApp(racing)
    const client = raceApp.client()
    await signIn(raceApp, client, 'rita@example.org')

    racerRef = 'RACE-1'
    const created = await client.post(
      routes.items.create.action.href(),
      itemFormFields({
        locationId: local.id,
        owner: `collectif:${frog.id}`,
        name: 'X',
        ref: 'RACE-1',
      }),
    )
    assert.equal(created.status, 400)
    assert.match(created.text, /porte déjà cette référence/)
    assert.match(created.text, /value="X"/)

    racerRef = 'RACE-2'
    const edited = await client.post(
      routes.items.edit.action.href({ itemId: amp.id }),
      itemFormFields({ name: 'Ampli renommé', ref: 'RACE-2' }),
    )
    assert.equal(edited.status, 400)
    assert.match(edited.text, /porte déjà cette référence/)
    assert.equal((await findItemById(db, amp.id))?.name, 'Ampli')
  })

  it('measures the reference after NFC, which can lengthen it', async () => {
    const lengthening = '\u0958'.repeat(31)
    assert.equal(lengthening.normalize('NFC').length, 62)
    const response = await add({ name: 'Pied', ref: lengthening })
    assert.equal(response.status, 400)
    assert.match(response.text, /60 caractères au maximum/)
  })

  it('stores a reference with one space where several were typed', async () => {
    const response = await add({ name: 'Mix', ref: 'DBL \u00a0 01' })
    const itemId = /\/materiel\/([0-9a-f-]{36})$/.exec(response.location ?? '')?.[1] ?? ''
    assert.equal((await findItemById(db, itemId))?.ref, 'DBL 01')
  })

  it('refuses a reference on several lines or longer than 60 characters', async () => {
    assert.equal((await add({ ref: 'A\u0007B' })).status, 400)
    const long = await add({ ref: 'x'.repeat(61) })
    assert.equal(long.status, 400)
    assert.match(long.text, /60 caractères au maximum/)
  })
})
