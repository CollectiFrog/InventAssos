// US-0.5.7: every implemented row of docs/dev/architecture/permissions.md, checked through the
// real router for each kind of actor. "Allowed" means the effect happened; "denied" means it did
// not and the server answered 403 or sent the actor to sign-in or to their status page.
import * as assert from 'remix/assert'
import { type Database, sql } from 'remix/data-table'
import { after, before, beforeEach, describe, it } from 'remix/test'

import { createTestApp, type TestApp, type TestClient } from '../test/app.ts'
import { signIn } from '../test/auth.ts'
import { createActiveCollectif, createPendingCollectif } from '../test/collectifs.ts'
import { openTestDatabase, resetDatabase } from '../test/database.ts'
import { createTestItem, itemFormFields } from '../test/items.ts'
import { createTestLocation } from '../test/locations.ts'
import { createActiveUser } from '../test/users.ts'
import { findCollectifById } from './data/collectifs.ts'
import { findItemById } from './data/items.ts'
import { findResponsible, setResponsible } from './data/responsibles.ts'
import { createUser, findUserById } from './data/users.ts'
import { routes } from './routes.ts'

type Actor = 'admin' | 'responsibleOfC' | 'responsibleOfD' | 'validated' | 'pending' | 'visitor'
const actors: Actor[] = [
  'admin',
  'responsibleOfC',
  'responsibleOfD',
  'validated',
  'pending',
  'visitor',
]

const emails: Record<Exclude<Actor, 'visitor'>, string> = {
  admin: 'admin@example.org',
  responsibleOfC: 'rita@example.org',
  responsibleOfD: 'otto@example.org',
  validated: 'val@example.org',
  pending: 'pat@example.org',
}

/** The world every case starts from. */
async function seed(db: Database) {
  const rita = await createActiveUser(db, 'Rita', emails.responsibleOfC)
  const otto = await createActiveUser(db, 'Otto', emails.responsibleOfD)
  const val = await createActiveUser(db, 'Val', emails.validated)
  await createUser(db, { name: 'Pat', email: emails.pending })
  const target = await createUser(db, { name: 'Tess', email: 'tess@example.org' })
  const zed = await createActiveUser(db, 'Zed', 'zed@example.org')
  const c = await createActiveCollectif(db, 'Collectif C', rita.id)
  await createActiveCollectif(db, 'Collectif D', otto.id)
  const pendingCollectif = await createPendingCollectif(db, 'Collectif E', zed.id)
  await setResponsible(db, { userId: zed.id, collectifId: c.id, status: 'pending' })
  const local = await createTestLocation(db, { collectifId: c.id }, 'Local C')
  const annex = await createTestLocation(db, { collectifId: c.id }, 'Annexe C')
  const item = await createTestItem(db, {
    locationId: local.id,
    owner: { collectifId: c.id },
    createdBy: rita.id,
    name: 'Projecteur C',
  })
  return { rita, otto, val, target, zed, c, pendingCollectif, local, annex, item }
}
type World = Awaited<ReturnType<typeof seed>>

interface Rule {
  /** The row of permissions.md. */
  row: string
  allowed: Actor[]
  act(
    client: TestClient,
    w: World,
  ): Promise<{ status: number; location: string | null; text: string }>
  /** "hidden": a denied actor still gets the page, without the protected data. */
  denial?: 'refused' | 'hidden'
  /** Did the effect happen? */
  happened(db: Database, w: World, response: { status: number; text: string }): Promise<boolean>
}

const rules: Rule[] = [
  {
    row: 'Approve or reject an account',
    allowed: ['admin'],
    act: (c, w) => c.post(routes.admin.approveAccount.href({ userId: w.target.id })),
    happened: async (db, w) => (await findUserById(db, w.target.id))?.status === 'active',
  },
  {
    row: 'Disable an account',
    allowed: ['admin'],
    act: (c, w) => c.post(routes.admin.disableAccount.href({ userId: w.zed.id })),
    happened: async (db, w) => (await findUserById(db, w.zed.id))?.status === 'disabled',
  },
  {
    row: 'Request a new collectif',
    allowed: ['admin', 'responsibleOfC', 'responsibleOfD', 'validated'],
    act: (c) => c.post(routes.collectifs.request.action.href(), { name: 'Collectif F' }),
    happened: async (db) => {
      const rows = await db.exec(sql`select 1 from collectifs where slug = 'collectif-f'`)
      return (rows.rows?.length ?? 0) > 0
    },
  },
  {
    row: 'Approve or reject a collectif',
    allowed: ['admin'],
    act: (c, w) =>
      c.post(routes.admin.collectifs.approve.href({ collectifId: w.pendingCollectif.id })),
    happened: async (db, w) =>
      (await findCollectifById(db, w.pendingCollectif.id))?.status === 'active',
  },
  {
    // "—" for admins and responsibles of C in the table: an admin may ask, a responsible of C need not.
    row: 'Request to become responsible of C',
    allowed: ['admin', 'responsibleOfD', 'validated'],
    act: (c, w) => c.post(routes.collectifs.requestResponsibility.href({ slug: w.c.slug })),
    happened: async (db) => {
      const rows = await db.exec(sql`
        select 1 from responsibles r join users u on u.id = r.user_id
        where r.status = 'pending' and u.email <> 'zed@example.org'
      `)
      return (rows.rows?.length ?? 0) > 0
    },
  },
  {
    row: 'Approve, reject or remove a responsible of C',
    allowed: ['admin'],
    act: (c, w) =>
      c.post(routes.admin.responsibles.approve.href({ collectifId: w.c.id, userId: w.zed.id })),
    happened: async (db, w) => (await findResponsible(db, w.zed.id, w.c.id))?.status === 'active',
  },
  {
    row: "Edit C's profile",
    allowed: ['admin', 'responsibleOfC'],
    act: (c, w) =>
      c.post(routes.collectifs.edit.action.href({ slug: w.c.slug }), { description: 'Changé' }),
    happened: async (db, w) => (await findCollectifById(db, w.c.id))?.description === 'Changé',
  },
  {
    row: "Create, edit, delete C's locations",
    allowed: ['admin', 'responsibleOfC'],
    act: (c, w) =>
      c.post(routes.locations.create.action.href(), {
        owner: `collectif:${w.c.id}`,
        name: 'Nouveau local',
        city: 'Rennes',
      }),
    happened: async (db) => {
      const rows = await db.exec(sql`select 1 from locations where name = 'Nouveau local'`)
      return (rows.rows?.length ?? 0) > 0
    },
  },
  {
    row: 'Create, edit, delete own personal locations',
    allowed: ['admin', 'responsibleOfC', 'responsibleOfD', 'validated'],
    act: (c) =>
      c.post(routes.locations.create.action.href(), {
        owner: 'me',
        name: 'Chez moi',
        city: 'Vitré',
      }),
    happened: async (db) => {
      const rows = await db.exec(sql`select 1 from locations where name = 'Chez moi'`)
      return (rows.rows?.length ?? 0) > 0
    },
  },
  {
    row: 'Add an item to a location',
    allowed: ['admin', 'responsibleOfC'],
    act: (c, w) =>
      c.post(
        routes.items.create.action.href(),
        itemFormFields({ locationId: w.local.id, owner: 'me', name: 'Ajout' }),
      ),
    happened: async (db) => {
      const rows = await db.exec(sql`select 1 from items where name = 'Ajout'`)
      return (rows.rows?.length ?? 0) > 0
    },
  },
  {
    row: 'Edit, move, archive an item',
    allowed: ['admin', 'responsibleOfC'],
    act: (c, w) =>
      c.post(
        routes.items.edit.action.href({ itemId: w.item.id }),
        itemFormFields({ name: 'Édité' }),
      ),
    happened: async (db, w) => (await findItemById(db, w.item.id))?.name === 'Édité',
  },
  {
    row: 'Move an item to a location',
    allowed: ['admin', 'responsibleOfC'],
    act: (c, w) =>
      c.post(routes.items.move.action.href({ itemId: w.item.id }), { locationId: w.annex.id }),
    happened: async (db, w) => (await findItemById(db, w.item.id))?.location_id === w.annex.id,
  },
  {
    row: 'See an item, its owner, the city of its location',
    allowed: ['admin', 'responsibleOfC', 'responsibleOfD', 'validated'],
    act: (c, w) => c.get(routes.items.show.href({ itemId: w.item.id })),
    happened: async (_db, _w, response) =>
      response.status === 200 && /Projecteur C/.test(response.text) && /Rennes/.test(response.text),
  },
  {
    row: "See a location's full address",
    allowed: ['admin', 'responsibleOfC'],
    denial: 'hidden',
    act: (c, w) => c.get(routes.locations.show.href({ locationId: w.local.id })),
    happened: async (_db, _w, response) => /12 rue Secrète/.test(response.text),
  },
]

describe('permissions matrix (US-0.5.7)', () => {
  let db: Database
  let app: TestApp
  let world: World

  before(async () => {
    db = await openTestDatabase()
  })
  beforeEach(async () => {
    await resetDatabase(db)
    world = await seed(db)
    app = createTestApp(db, { adminEmails: [emails.admin] })
  })
  after(async () => {
    await db.close()
  })

  for (const rule of rules) {
    for (const actor of actors) {
      const expected = rule.allowed.includes(actor)
      it(`${rule.row}: ${actor} → ${expected ? 'allowed' : 'denied'}`, async () => {
        const client = app.client()
        if (actor !== 'visitor') await signIn(app, client, emails[actor])

        const response = await rule.act(client, world)
        const happened = await rule.happened(db, world, response)

        assert.equal(happened, expected)
        if (!expected && rule.denial !== 'hidden') {
          const sentAway =
            response.location === routes.signIn.form.index.href() ||
            response.location === routes.account.status.href()
          assert.ok(
            response.status === 403 || sentAway || response.status === 404,
            `denied with status ${response.status} ${response.location ?? ''}`,
          )
        }
      })
    }
  }
})
