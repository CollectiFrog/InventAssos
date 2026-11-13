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
import { csvFile, uploadFile } from '../test/imports.ts'
import { createTestItem, itemFormFields } from '../test/items.ts'
import { createTestLocation } from '../test/locations.ts'
import { createActiveUser } from '../test/users.ts'
import { findCategory, listCategories } from './data/categories.ts'
import { findCollectifById } from './data/collectifs.ts'
import { hasDeletionRequest, requestItemDeletion } from './data/deletion-requests.ts'
import { archiveItem, findItemById } from './data/items.ts'
import { findLocationById } from './data/locations.ts'
import {
  decideMembership,
  findMembership,
  findResponsible,
  requestMembership,
  setResponsible,
} from './data/members.ts'
import { createUser, findUserById, setUserRole, setUserStatus } from './data/users.ts'
import { routes } from './routes.ts'

type Actor =
  | 'admin'
  | 'moderator'
  | 'responsibleOfC'
  | 'responsibleOfD'
  | 'memberOfC'
  | 'validated'
  | 'pending'
  | 'visitor'
const actors: Actor[] = [
  'admin',
  'moderator',
  'responsibleOfC',
  'responsibleOfD',
  'memberOfC',
  'validated',
  'pending',
  'visitor',
]

const emails: Record<Exclude<Actor, 'visitor'>, string> = {
  admin: 'admin@example.org',
  moderator: 'mona@example.org',
  responsibleOfC: 'rita@example.org',
  responsibleOfD: 'otto@example.org',
  memberOfC: 'mia@example.org',
  validated: 'val@example.org',
  pending: 'pat@example.org',
}

/** A second platform admin, listed in PLATFORM_ADMIN_EMAILS but not one of the six actors. */
const coAdminEmail = 'ada@example.org'

/** The world every case starts from. */
async function seed(db: Database) {
  const rita = await createActiveUser(db, 'Rita', emails.responsibleOfC)
  const otto = await createActiveUser(db, 'Otto', emails.responsibleOfD)
  const val = await createActiveUser(db, 'Val', emails.validated)
  await createUser(db, { name: 'Pat', email: emails.pending })
  const target = await createUser(db, { name: 'Tess', email: 'tess@example.org' })
  const zed = await createActiveUser(db, 'Zed', 'zed@example.org')
  const coAdmin = await createActiveUser(db, 'Ada', coAdminEmail)
  const gone = await createActiveUser(db, 'Gus', 'gus@example.org')
  await setUserStatus(db, gone.id, 'disabled')
  // Moderators (US-0.8.1): Mona acts; Max is active and Gil disabled, both out of her reach.
  const mona = await createActiveUser(db, 'Mona', emails.moderator)
  await setUserRole(db, mona.id, 'moderator')
  const max = await createActiveUser(db, 'Max', 'max@example.org')
  await setUserRole(db, max.id, 'moderator')
  const gil = await createActiveUser(db, 'Gil', 'gil@example.org')
  await setUserRole(db, gil.id, 'moderator')
  await setUserStatus(db, gil.id, 'disabled')
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
  // The "validated user" branches: Val's home, her deposit at C, and C's item kept at her home.
  const valHome = await createTestLocation(db, { userId: val.id }, 'Chez Val')
  const valGarage = await createTestLocation(db, { userId: val.id }, 'Garage de Val')
  const ritaHome = await createTestLocation(db, { userId: rita.id }, 'Chez Rita')
  const valAtC = await createTestItem(db, {
    locationId: local.id,
    owner: { userId: val.id },
    createdBy: rita.id,
    name: 'Ampli de Val',
  })
  const cAtVal = await createTestItem(db, {
    locationId: valHome.id,
    owner: { collectifId: c.id },
    createdBy: val.id,
    name: 'Pied de C',
  })
  const archived = await createTestItem(db, {
    locationId: local.id,
    owner: { collectifId: c.id },
    createdBy: rita.id,
    name: 'Console archivée',
  })
  await archiveItem(db, archived.id, 'sold')
  // Visibility branches (ADR 0021): Cora, a second responsible of C, and her own drill at home;
  // Val's own item at her home (her garage stays empty for the delete case).
  const cora = await createActiveUser(db, 'Cora', 'cora@example.org')
  await setResponsible(db, { userId: cora.id, collectifId: c.id, status: 'active' })
  const coraHome = await createTestLocation(db, { userId: cora.id }, 'Chez Cora')
  const coraItem = await createTestItem(db, {
    locationId: coraHome.id,
    owner: { userId: cora.id },
    createdBy: cora.id,
    name: 'Perceuse de Cora',
  })
  // Members (US-0.8.3): Mia belongs to C; Pia asked to join and waits.
  const mia = await createActiveUser(db, 'Mia', emails.memberOfC)
  await requestMembership(db, mia.id, c.id)
  await decideMembership(db, {
    userId: mia.id,
    collectifId: c.id,
    from: { status: 'pending' },
    status: 'active',
    decidedBy: rita.id,
  })
  const pia = await createActiveUser(db, 'Pia', 'pia@example.org')
  await requestMembership(db, pia.id, c.id)
  // US-0.8.10: Mia asked to delete C's foot stored at Val's.
  await requestItemDeletion(db, cAtVal.id, mia.id)
  const valOwn = await createTestItem(db, {
    locationId: valHome.id,
    owner: { userId: val.id },
    createdBy: val.id,
    name: 'Scie de Val',
  })
  return {
    mia,
    pia,
    max,
    gil,
    cora,
    coraItem,
    coraHome,
    valOwn,
    coAdmin,
    gone,
    archived,
    rita,
    otto,
    val,
    target,
    zed,
    c,
    pendingCollectif,
    local,
    annex,
    item,
    valHome,
    valGarage,
    ritaHome,
    valAtC,
    cAtVal,
  }
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
    allowed: ['admin', 'moderator'],
    act: (c, w) => c.post(routes.admin.approveAccount.href({ userId: w.target.id })),
    happened: async (db, w) => (await findUserById(db, w.target.id))?.status === 'active',
  },
  {
    row: 'Add, rename, reorder, delete an unused category (add)',
    allowed: ['admin', 'moderator'],
    act: (c) => c.post(routes.admin.categories.create.href(), { name: 'Instruments' }),
    happened: async (db) => (await findCategory(db, 'instruments')) !== null,
  },
  {
    row: 'Add, rename, reorder, delete an unused category (rename)',
    allowed: ['admin', 'moderator'],
    act: (c) =>
      c.post(routes.admin.categories.rename.href({ categoryId: 'video' }), { name: 'Image' }),
    happened: async (db) => (await findCategory(db, 'video'))?.name === 'Image',
  },
  {
    row: 'Add, rename, reorder, delete an unused category (reorder)',
    allowed: ['admin', 'moderator'],
    act: (c) => c.post(routes.admin.categories.up.href({ categoryId: 'lighting' })),
    happened: async (db) => (await listCategories(db))[0]?.id === 'lighting',
  },
  {
    row: 'Add, rename, reorder, delete an unused category (delete)',
    allowed: ['admin', 'moderator'],
    act: (c) => c.post(routes.admin.categories.remove.href({ categoryId: 'video' })),
    happened: async (db) => (await findCategory(db, 'video')) === null,
  },
  {
    row: 'Disable an account',
    allowed: ['admin', 'moderator'],
    act: (c, w) => c.post(routes.admin.disableAccount.href({ userId: w.zed.id })),
    happened: async (db, w) => (await findUserById(db, w.zed.id))?.status === 'disabled',
  },
  {
    // One admin must not lock the others out (review F12).
    row: 'Disable an account (another listed admin)',
    allowed: [],
    act: (c, w) => c.post(routes.admin.disableAccount.href({ userId: w.coAdmin.id })),
    happened: async (db, w) => (await findUserById(db, w.coAdmin.id))?.status === 'disabled',
  },
  {
    row: 'Re-enable a disabled account',
    allowed: ['admin', 'moderator'],
    act: (c, w) => c.post(routes.admin.enableAccount.href({ userId: w.gone.id })),
    happened: async (db, w) => (await findUserById(db, w.gone.id))?.status === 'active',
  },
  {
    // A moderator never acts on another moderator (US-0.8.2); an admin may.
    row: 'Disable an account (another moderator)',
    allowed: ['admin'],
    act: (c, w) => c.post(routes.admin.disableAccount.href({ userId: w.max.id })),
    happened: async (db, w) => (await findUserById(db, w.max.id))?.status === 'disabled',
  },
  {
    row: 'Re-enable a disabled account (a moderator)',
    allowed: ['admin'],
    act: (c, w) => c.post(routes.admin.enableAccount.href({ userId: w.gil.id })),
    happened: async (db, w) => (await findUserById(db, w.gil.id))?.status === 'active',
  },
  {
    row: 'Name or remove a moderator (name)',
    allowed: ['admin'],
    act: (c) => c.post(routes.admin.moderators.name.href(), { email: emails.validated }),
    happened: async (db, w) => (await findUserById(db, w.val.id))?.role === 'moderator',
  },
  {
    row: 'Name or remove a moderator (remove)',
    allowed: ['admin'],
    act: (c, w) => c.post(routes.admin.moderators.remove.href({ userId: w.max.id })),
    happened: async (db, w) => (await findUserById(db, w.max.id))?.role === 'member',
  },
  {
    row: 'Edit own profile (name, phone)',
    allowed: ['admin', 'moderator', 'responsibleOfC', 'responsibleOfD', 'validated', 'memberOfC'],
    act: (c) => c.post(routes.account.profile.action.href(), { name: 'Renommé', phone: '' }),
    happened: async (db) => {
      const rows = await db.exec(sql`select 1 from users where name = 'Renommé'`)
      return (rows.rows?.length ?? 0) > 0
    },
  },
  {
    row: 'Request a new collectif',
    allowed: ['admin', 'moderator', 'responsibleOfC', 'responsibleOfD', 'validated', 'memberOfC'],
    act: (c) =>
      c.post(routes.collectifs.request.action.href(), { name: 'Collectif F', city: 'Vitré' }),
    happened: async (db) => {
      const rows = await db.exec(sql`select 1 from collectifs where slug = 'collectif-f'`)
      return (rows.rows?.length ?? 0) > 0
    },
  },
  {
    row: 'Approve or reject a collectif',
    allowed: ['admin', 'moderator'],
    act: (c, w) =>
      c.post(routes.admin.collectifs.approve.href({ collectifId: w.pendingCollectif.id })),
    happened: async (db, w) =>
      (await findCollectifById(db, w.pendingCollectif.id))?.status === 'active',
  },
  {
    // "—" for admins and responsibles of C in the table: an admin may ask, a responsible of C need not.
    row: 'Request to become responsible of C',
    allowed: ['admin', 'moderator', 'responsibleOfD', 'validated'],
    act: (c, w) => c.post(routes.collectifs.requestResponsibility.href({ slug: w.c.slug })),
    happened: async (db) => {
      const rows = await db.exec(sql`
        select 1 from collectif_members r join users u on u.id = r.user_id
        where r.role = 'responsible' and r.status = 'pending' and u.email <> 'zed@example.org'
      `)
      return (rows.rows?.length ?? 0) > 0
    },
  },
  {
    row: 'Approve, reject or remove a responsible of C',
    allowed: ['admin', 'moderator'],
    act: (c, w) =>
      c.post(routes.admin.responsibles.approve.href({ collectifId: w.c.id, userId: w.zed.id })),
    happened: async (db, w) => (await findResponsible(db, w.zed.id, w.c.id))?.status === 'active',
  },
  {
    // US-0.8.3: anyone validated who does not belong to C yet.
    row: 'Ask to join C',
    allowed: ['admin', 'moderator', 'responsibleOfD', 'validated'],
    act: (c, w) => c.post(routes.collectifs.join.href({ slug: w.c.slug })),
    happened: async (db, w) => {
      const rows = await db.exec(sql`
        select 1 from collectif_members
        where collectif_id = ${w.c.id} and role = 'member' and status = 'pending'
          and user_id <> ${w.pia.id}
      `)
      return (rows.rows?.length ?? 0) > 0
    },
  },
  {
    // US-0.8.4: C's responsibles only; neither the platform nor C's members.
    row: 'Accept, reject or remove a member of C',
    allowed: ['responsibleOfC'],
    act: (c, w) =>
      c.post(routes.collectifs.members.approve.href({ slug: w.c.slug, userId: w.pia.id })),
    happened: async (db, w) => (await findMembership(db, w.pia.id, w.c.id))?.status === 'active',
  },
  {
    row: 'Accept, reject or remove a member of C (remove)',
    allowed: ['responsibleOfC'],
    act: (c, w) =>
      c.post(routes.collectifs.members.remove.href({ slug: w.c.slug, userId: w.mia.id })),
    happened: async (db, w) => (await findMembership(db, w.mia.id, w.c.id))?.status === 'removed',
  },
  {
    // US-0.8.6: C's responsibles, and the platform so that C never lacks one.
    row: 'Make a member of C responsible, remove a responsible of C',
    allowed: ['admin', 'moderator', 'responsibleOfC'],
    act: (c, w) =>
      c.post(routes.collectifs.members.promote.href({ slug: w.c.slug, userId: w.mia.id })),
    happened: async (db, w) => (await findMembership(db, w.mia.id, w.c.id))?.role === 'responsible',
  },
  {
    row: 'Make a member of C responsible, remove a responsible of C (remove)',
    allowed: ['admin', 'moderator', 'responsibleOfC'],
    act: (c, w) =>
      c.post(routes.collectifs.members.demote.href({ slug: w.c.slug, userId: w.cora.id })),
    happened: async (db, w) => (await findMembership(db, w.cora.id, w.c.id))?.role === 'member',
  },
  {
    // US-0.8.8: any person of C; C keeps Cora as responsible when Rita leaves.
    row: 'Leave C',
    allowed: ['responsibleOfC', 'memberOfC'],
    act: (c, w) => c.post(routes.collectifs.members.leave.href({ slug: w.c.slug })),
    happened: async (db) => {
      const rows = await db.exec(sql`select 1 from audit_log where action = 'member.left'`)
      return (rows.rows?.length ?? 0) > 0
    },
  },
  {
    row: "Edit C's profile",
    allowed: ['admin', 'responsibleOfC'],
    act: (c, w) =>
      c.post(routes.collectifs.edit.action.href({ slug: w.c.slug }), {
        city: 'Rennes',
        description: 'Changé',
      }),
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
    row: "Create, edit, delete C's locations (edit)",
    allowed: ['admin', 'responsibleOfC'],
    act: (c, w) =>
      c.post(routes.locations.edit.action.href({ locationId: w.local.id }), {
        name: 'Local renommé',
        city: 'Rennes',
      }),
    happened: async (db, w) => (await findLocationById(db, w.local.id))?.name === 'Local renommé',
  },
  {
    row: "Create, edit, delete C's locations (delete)",
    allowed: ['admin', 'responsibleOfC'],
    act: (c, w) => c.post(routes.locations.remove.href({ locationId: w.annex.id })),
    happened: async (db, w) => (await findLocationById(db, w.annex.id)) === null,
  },
  {
    row: 'Create, edit, delete own personal locations',
    allowed: ['admin', 'moderator', 'responsibleOfC', 'responsibleOfD', 'validated', 'memberOfC'],
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
    // "Own": only Val may change Val's home, admins included.
    row: "Create, edit, delete own personal locations (edit Val's home)",
    allowed: ['validated'],
    act: (c, w) =>
      c.post(routes.locations.edit.action.href({ locationId: w.valHome.id }), {
        name: 'Chez Val, garage',
        city: 'Rennes',
      }),
    happened: async (db, w) =>
      (await findLocationById(db, w.valHome.id))?.name === 'Chez Val, garage',
  },
  {
    row: "Create, edit, delete own personal locations (delete Val's empty home)",
    allowed: ['validated'],
    // A location that holds items cannot be deleted (US-0.4.1): Val's garage is empty.
    act: (c, w) => c.post(routes.locations.remove.href({ locationId: w.valGarage.id })),
    happened: async (db, w) => (await findLocationById(db, w.valGarage.id)) === null,
  },
  {
    row: 'Add an item to a location',
    allowed: ['admin', 'responsibleOfC', 'memberOfC'],
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
    // US-0.8.5: the collectif's own equipment, added by any person of C.
    row: "Add an item to a location (C's item in C's location)",
    allowed: ['admin', 'responsibleOfC', 'memberOfC'],
    act: (c, w) =>
      c.post(
        routes.items.create.action.href(),
        itemFormFields({
          locationId: w.local.id,
          owner: `collectif:${w.c.id}`,
          name: 'Ajout de C',
        }),
      ),
    happened: async (db, w) => {
      const rows = await db.exec(
        sql`select 1 from items where name = 'Ajout de C' and owner_collectif_id = ${w.c.id}`,
      )
      return (rows.rows?.length ?? 0) > 0
    },
  },
  {
    row: 'Add an item to a location (own location)',
    allowed: ['admin', 'validated'],
    act: (c, w) =>
      c.post(
        routes.items.create.action.href(),
        itemFormFields({ locationId: w.valHome.id, owner: 'me', name: 'Ajout chez Val' }),
      ),
    happened: async (db) => {
      const rows = await db.exec(sql`select 1 from items where name = 'Ajout chez Val'`)
      return (rows.rows?.length ?? 0) > 0
    },
  },
  {
    // US-0.5.2: a person's item stored in C's location, set by whoever manages that location.
    row: "Add an item to a location (deposit: Val's item in C's location)",
    allowed: ['admin', 'responsibleOfC'],
    act: (c, w) =>
      c.post(
        routes.items.create.action.href(),
        itemFormFields({
          locationId: w.local.id,
          owner: 'person',
          ownerEmail: emails.validated,
          name: 'Dépôt de Val',
        }),
      ),
    happened: async (db, w) => {
      const rows = await db.exec(
        sql`select 1 from items where name = 'Dépôt de Val' and owner_user_id = ${w.val.id}`,
      )
      return (rows.rows?.length ?? 0) > 0
    },
  },
  {
    row: 'Edit, move, archive an item',
    allowed: ['admin', 'responsibleOfC', 'memberOfC'],
    act: (c, w) =>
      c.post(
        routes.items.edit.action.href({ itemId: w.item.id }),
        itemFormFields({ name: 'Édité' }),
      ),
    happened: async (db, w) => (await findItemById(db, w.item.id))?.name === 'Édité',
  },
  {
    row: 'Edit, move, archive an item (archive)',
    allowed: ['admin', 'responsibleOfC', 'memberOfC'],
    act: (c, w) =>
      c.post(routes.items.archive.action.href({ itemId: w.item.id }), { reason: 'sold' }),
    happened: async (db, w) => (await findItemById(db, w.item.id))?.archived_at != null,
  },
  {
    // US-0.8.2: the owner is e-mailed the message; managers archive with their own reasons.
    row: 'Archive an abusive item',
    allowed: ['admin', 'moderator'],
    act: (c, w) =>
      c.post(routes.items.archive.action.href({ itemId: w.item.id }), {
        reason: 'moderated',
        message: 'Annonce abusive.',
      }),
    happened: async (db, w) => (await findItemById(db, w.item.id))?.archive_reason === 'moderated',
  },
  {
    // US-0.10.1: into C's locations, its responsibles (and admins); members later (ADR 0027).
    row: 'Import a file into a location',
    allowed: ['admin', 'responsibleOfC'],
    act: (c, w) => uploadFile(c, w.local.id, csvFile([['Nom'], ['Importé']])),
    happened: async (db) => {
      const rows = await db.exec(sql`select 1 from imports`)
      return (rows.rows?.length ?? 0) > 0
    },
  },
  {
    row: 'Import a file into a location (own location)',
    allowed: ['validated'],
    act: (c, w) => uploadFile(c, w.valHome.id, csvFile([['Nom'], ['Importé']])),
    happened: async (db) => {
      const rows = await db.exec(sql`select 1 from imports`)
      return (rows.rows?.length ?? 0) > 0
    },
  },
  {
    // US-0.10.4: members and moderators export only their own for now (ADR 0026).
    row: "Export an owner's equipment (C's)",
    allowed: ['admin', 'responsibleOfC'],
    act: (c, w) => c.post(routes.exports.collectif.href({ slug: w.c.slug })),
    happened: async (_db, _w, response) =>
      response.status === 200 && /Projecteur C/.test(response.text),
  },
  {
    row: "Export an owner's equipment (own)",
    allowed: ['admin', 'moderator', 'responsibleOfC', 'responsibleOfD', 'memberOfC', 'validated'],
    act: (c) => c.post(routes.exports.mine.href()),
    happened: async (_db, _w, response) =>
      // Reading the body as text drops the BOM; `toCsv`'s own test checks it is sent.
      response.status === 200 && /^\uFEFF?Référence;Nom;/.test(response.text),
  },
  {
    // US-0.10.3: the reference lives in its owner's namespace.
    row: "Give or change an item's reference",
    allowed: ['admin', 'responsibleOfC', 'memberOfC'],
    act: (c, w) =>
      c.post(
        routes.items.edit.action.href({ itemId: w.item.id }),
        itemFormFields({ name: 'Projecteur C', ref: 'PROJ-1' }),
      ),
    happened: async (db, w) => (await findItemById(db, w.item.id))?.ref === 'PROJ-1',
  },
  {
    // C's responsible may edit Val's deposit, but not name it in Val's namespace. The field sits
    // in a form they may submit, so the refusal is a form error (400), not a 403.
    row: "Give or change an item's reference (Val's item stored at C)",
    allowed: ['admin', 'validated'],
    denial: 'hidden',
    act: (c, w) =>
      c.post(
        routes.items.edit.action.href({ itemId: w.valAtC.id }),
        itemFormFields({ name: 'Ampli de Val', ref: 'VAL-1' }),
      ),
    happened: async (db, w) => (await findItemById(db, w.valAtC.id))?.ref === 'VAL-1',
  },
  {
    // US-0.8.9: final, so a member of C asks instead (next rows).
    row: 'Delete an item',
    allowed: ['admin', 'moderator', 'responsibleOfC'],
    act: (c, w) =>
      c.post(routes.items.remove.action.href({ itemId: w.item.id }), {
        message: 'Saisi par erreur.',
      }),
    happened: async (db, w) => (await findItemById(db, w.item.id)) === null,
  },
  {
    row: 'Delete an item (own item)',
    allowed: ['admin', 'moderator', 'validated'],
    act: (c, w) =>
      c.post(routes.items.remove.action.href({ itemId: w.valOwn.id }), {
        message: 'Saisi par erreur.',
      }),
    happened: async (db, w) => (await findItemById(db, w.valOwn.id)) === null,
  },
  {
    row: 'Ask to delete an item of C',
    allowed: ['memberOfC'],
    act: (c, w) => c.post(routes.items.requestDeletion.href({ itemId: w.item.id })),
    happened: async (db, w) => hasDeletionRequest(db, w.item.id),
  },
  {
    row: 'Accept or reject a request to delete an item of C',
    allowed: ['responsibleOfC'],
    act: (c, w) =>
      c.post(routes.collectifs.deletions.approve.href({ slug: w.c.slug, itemId: w.cAtVal.id })),
    happened: async (db, w) => (await findItemById(db, w.cAtVal.id)) === null,
  },
  {
    // US-0.5.5: an archived item has left the inventory; nobody changes it any more (review F6).
    row: 'Edit, move or archive an archived item (edit)',
    allowed: [],
    act: (c, w) =>
      c.post(
        routes.items.edit.action.href({ itemId: w.archived.id }),
        itemFormFields({ name: 'Ressuscitée' }),
      ),
    happened: async (db, w) => (await findItemById(db, w.archived.id))?.name === 'Ressuscitée',
  },
  {
    row: 'Edit, move or archive an archived item (move)',
    allowed: [],
    act: (c, w) =>
      c.post(routes.items.move.action.href({ itemId: w.archived.id }), { locationId: w.annex.id }),
    happened: async (db, w) => (await findItemById(db, w.archived.id))?.location_id === w.annex.id,
  },
  {
    // Val owns it; C's responsible manages where it is stored (ADR 0009).
    row: "Edit, move, archive an item (Val's item stored at C)",
    allowed: ['admin', 'responsibleOfC', 'validated'],
    act: (c, w) =>
      c.post(
        routes.items.edit.action.href({ itemId: w.valAtC.id }),
        itemFormFields({ name: 'Ampli révisé', condition: 'repair' }),
      ),
    happened: async (db, w) => (await findItemById(db, w.valAtC.id))?.condition === 'repair',
  },
  {
    row: "Edit, move, archive an item (C's item stored at Val's home)",
    allowed: ['admin', 'responsibleOfC', 'validated', 'memberOfC'],
    act: (c, w) =>
      c.post(routes.items.archive.action.href({ itemId: w.cAtVal.id }), { reason: 'broken' }),
    happened: async (db, w) => (await findItemById(db, w.cAtVal.id))?.archived_at != null,
  },
  {
    row: 'Move an item to a location',
    allowed: ['admin', 'responsibleOfC', 'memberOfC'],
    act: (c, w) =>
      c.post(routes.items.move.action.href({ itemId: w.item.id }), { locationId: w.annex.id }),
    happened: async (db, w) => (await findItemById(db, w.item.id))?.location_id === w.annex.id,
  },
  {
    // Val may edit her item stored at C, and may store items at her home; Rita may not.
    row: 'Move an item to a location (own location)',
    allowed: ['admin', 'validated'],
    act: (c, w) =>
      c.post(routes.items.move.action.href({ itemId: w.valAtC.id }), { locationId: w.valHome.id }),
    happened: async (db, w) => (await findItemById(db, w.valAtC.id))?.location_id === w.valHome.id,
  },
  {
    // F11: a responsible may move an item they manage to any location they manage, their home too.
    row: "Move an item to a location (C's responsible moves Val's deposit home)",
    allowed: ['admin', 'responsibleOfC'],
    act: (c, w) =>
      c.post(routes.items.move.action.href({ itemId: w.valAtC.id }), { locationId: w.ritaHome.id }),
    happened: async (db, w) => (await findItemById(db, w.valAtC.id))?.location_id === w.ritaHome.id,
  },
  {
    row: 'See an item, its owner, the city of its location',
    allowed: ['admin', 'moderator', 'responsibleOfC', 'memberOfC'],
    act: (c, w) => c.get(routes.items.show.href({ itemId: w.item.id })),
    happened: async (_db, _w, response) =>
      response.status === 200 && /Projecteur C/.test(response.text) && /Rennes/.test(response.text),
  },
  {
    row: 'See an item, its owner, the city of its location (owned by a person of C)',
    allowed: ['admin', 'moderator', 'responsibleOfC', 'memberOfC'],
    act: (c, w) => c.get(routes.items.show.href({ itemId: w.coraItem.id })),
    happened: async (_db, _w, response) =>
      response.status === 200 && /Perceuse de Cora/.test(response.text),
  },
  {
    row: 'See an item, its owner, the city of its location (own item)',
    allowed: ['admin', 'moderator', 'validated'],
    act: (c, w) => c.get(routes.items.show.href({ itemId: w.valOwn.id })),
    happened: async (_db, _w, response) =>
      response.status === 200 && /Scie de Val/.test(response.text),
  },
  {
    row: "See an item, its owner, the city of its location (C's item in own location)",
    allowed: ['admin', 'moderator', 'responsibleOfC', 'validated', 'memberOfC'],
    act: (c, w) => c.get(routes.items.show.href({ itemId: w.cAtVal.id })),
    happened: async (_db, _w, response) =>
      response.status === 200 && /Pied de C/.test(response.text),
  },
  {
    row: "See a person's page and phone",
    allowed: ['admin', 'moderator', 'responsibleOfC', 'memberOfC'],
    act: (c, w) => c.get(routes.people.show.href({ userId: w.cora.id })),
    happened: async (_db, _w, response) =>
      response.status === 200 && /<h1>Cora<\/h1>/.test(response.text),
  },
  {
    row: "See a person's page and phone (own page)",
    allowed: ['admin', 'moderator', 'validated'],
    act: (c, w) => c.get(routes.people.show.href({ userId: w.val.id })),
    happened: async (_db, _w, response) =>
      response.status === 200 && /<h1>Val<\/h1>/.test(response.text),
  },
  {
    row: 'See the collectifs directory (name, city, text)',
    allowed: ['admin', 'moderator', 'responsibleOfC', 'responsibleOfD', 'validated', 'memberOfC'],
    act: (c) => c.get(routes.collectifs.index.href()),
    happened: async (_db, _w, response) =>
      response.status === 200 && /Collectif C/.test(response.text),
  },
  {
    row: "See C's equipment, locations and people",
    allowed: ['admin', 'moderator', 'responsibleOfC', 'memberOfC'],
    denial: 'hidden',
    // The three tabs of C's page together (US-0.7.5).
    act: async (c, w) => {
      const tabs = [routes.collectifs.show, routes.collectifs.places, routes.collectifs.people]
      const pages = await Promise.all(tabs.map((route) => c.get(route.href({ slug: w.c.slug }))))
      const [first] = pages
      return {
        status: first?.status ?? 0,
        location: first?.location ?? null,
        text: pages.map((page) => page.text).join('\n'),
      }
    },
    happened: async (_db, _w, response) =>
      /Projecteur C/.test(response.text) &&
      /Local C/.test(response.text) &&
      /Cora/.test(response.text),
  },
  {
    // Val sees C's local: her amp is stored there, and its page links to the place.
    row: 'See a location (name, city)',
    allowed: ['admin', 'moderator', 'responsibleOfC', 'validated', 'memberOfC'],
    act: (c, w) => c.get(routes.locations.show.href({ locationId: w.local.id })),
    happened: async (_db, _w, response) => response.status === 200 && /Local C/.test(response.text),
  },
  {
    row: "See a location (name, city) (someone else's home)",
    allowed: ['admin', 'moderator', 'responsibleOfC', 'memberOfC'],
    act: (c, w) => c.get(routes.locations.show.href({ locationId: w.coraHome.id })),
    happened: async (_db, _w, response) =>
      response.status === 200 && /Chez Cora/.test(response.text),
  },
  {
    row: "See a location's full address",
    allowed: ['admin', 'responsibleOfC', 'memberOfC'],
    denial: 'hidden',
    act: (c, w) => c.get(routes.locations.show.href({ locationId: w.local.id })),
    happened: async (_db, _w, response) => /12 rue Secrète/.test(response.text),
  },
  {
    row: "See a location's full address (own location)",
    allowed: ['admin', 'validated'],
    denial: 'hidden',
    act: (c, w) => c.get(routes.locations.show.href({ locationId: w.valHome.id })),
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
    app = createTestApp(db, { adminEmails: [emails.admin, coAdminEmail] })
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
            // A visitor goes to sign-in, with the page asked for kept for afterwards (US-0.7.8).
            response.location === routes.signIn.form.index.href() ||
            response.location?.startsWith(`${routes.signIn.form.index.href()}?suite=`) ||
            response.location === routes.account.status.href()
          assert.ok(
            // 413: a file from someone with no upload allowance is refused before it is read.
            response.status === 403 ||
              sentAway ||
              response.status === 404 ||
              response.status === 413,
            `denied with status ${response.status} ${response.location ?? ''}`,
          )
        }
      })
    }
  }
})
