// ADR 0018: limits on every endpoint that sends e-mail, and sign-in / sign-up timing (US-0.2.2).
import * as assert from 'remix/assert'
import { type Database, sql } from 'remix/data-table'
import { after, before, beforeEach, describe, it } from 'remix/test'

import { createTestApp, TestClient, testOrigin } from '../test/app.ts'
import { signIn } from '../test/auth.ts'
import { createActiveCollectif } from '../test/collectifs.ts'
import { openTestDatabase, resetDatabase } from '../test/database.ts'
import { createTestItem } from '../test/items.ts'
import { createTestLocation } from '../test/locations.ts'
import { createActiveUser } from '../test/users.ts'
import { createBackgroundTasks } from './background.ts'
import { clientAddressHeader, clientAddressOf, withClientAddress } from './client-address.ts'
import { deleteExpiredRateLimits, hitRateLimit } from './data/rate-limits.ts'
import { findResponsible, setResponsible } from './data/responsibles.ts'
import { createUser, findUserByEmail, setUserStatus } from './data/users.ts'
import type { Mail, Mailer } from './mail/mailer.ts'
import { defaultRateLimits } from './rate-limits.ts'
import { createAppRouter } from './router.ts'
import { routes } from './routes.ts'

const signInUrl = routes.signIn.form.action.href()
const signUpUrl = routes.signUp.form.action.href()

describe('rate limits (ADR 0018)', () => {
  let db: Database

  before(async () => {
    db = await openTestDatabase()
  })
  beforeEach(async () => {
    await resetDatabase(db)
  })
  after(async () => {
    await db.close()
  })

  it('counts hits per key in a window, then starts again; only a hash of the key is kept', async () => {
    const rule = { limit: 2, windowSeconds: 60 }
    const hits = []
    for (let i = 0; i < 3; i++) hits.push((await hitRateLimit(db, 'mail:a@x.org', rule)).allowed)
    assert.deepEqual(hits, [true, true, false])
    assert.equal((await hitRateLimit(db, 'mail:b@x.org', rule)).allowed, true)

    await db.exec(sql`update rate_limits set reset_at = now() - interval '1 second'`)
    assert.equal((await hitRateLimit(db, 'mail:a@x.org', rule)).allowed, true)
    const stored = await db.exec(sql`select key_hash from rate_limits`)
    assert.doesNotMatch(JSON.stringify(stored.rows), /x\.org|mail:/)
  })

  it('purges the counters whose window has ended', async () => {
    const rule = { limit: 2, windowSeconds: 60 }
    await hitRateLimit(db, 'old', rule)
    await hitRateLimit(db, 'live', rule)
    await db.exec(sql`update rate_limits set reset_at = now() - interval '1 second' where hits = 1
      and key_hash = (select key_hash from rate_limits order by reset_at limit 1)`)
    await deleteExpiredRateLimits(db)
    const left = await db.exec(sql`select count(*)::int as n from rate_limits`)
    assert.equal(left.rows?.[0]?.n, 1)
  })

  it('sends at most 5 sign-in links an hour to one address, whoever asks', async () => {
    await createActiveUser(db, 'Camille', 'camille@example.org')
    const app = createTestApp(db, { rateLimits: defaultRateLimits })
    for (let i = 0; i < 7; i++) {
      const response = await app.client({ address: `10.0.0.${i}` }).post(signInUrl, {
        email: 'camille@example.org',
      })
      assert.equal(response.location, routes.signIn.sent.href(), 'same answer when over the limit')
    }
    assert.equal(app.mailer.outbox.length, 5)
  })

  it('answers 429 after 20 sign-in or sign-up forms from one client address', async () => {
    const app = createTestApp(db, { rateLimits: defaultRateLimits })
    const client = app.client({ address: '192.0.2.1' })
    for (let i = 0; i < 10; i++) {
      await client.post(signInUrl, { email: `nobody${i}@example.org` })
      await client.post(signUpUrl, { name: 'X', email: `new${i}@example.org` })
    }
    const refused = await client.post(signUpUrl, { name: 'X', email: 'last@example.org' })
    assert.equal(refused.status, 429)
    assert.match(refused.text, /Trop de demandes/)
    assert.ok(Number(refused.headers.get('Retry-After')) > 0)
    assert.equal(await findUserByEmail(db, 'last@example.org'), null)

    const other = app.client({ address: '192.0.2.2' })
    assert.equal((await other.post(signInUrl, { email: 'x@example.org' })).status, 303)
  })

  it('tells the admins about at most 5 new accounts an hour; the queue still lists all', async () => {
    const app = createTestApp(db, {
      adminEmails: ['admin@example.org'],
      rateLimits: defaultRateLimits,
    })
    for (let i = 0; i < 7; i++) {
      await app.client({ address: `10.0.1.${i}` }).post(signUpUrl, {
        name: `Person ${i}`,
        email: `person${i}@example.org`,
      })
    }
    const toAdmins = app.mailer.outbox.filter((mail) => Array.isArray(mail.to))
    assert.equal(toAdmins.length, 5)
    const pending = await db.exec(
      sql`select count(*)::int as n from users where status = 'pending'`,
    )
    assert.equal(pending.rows?.[0]?.n, 7)
  })

  it('caps the contact messages one user sends: 10 a day', async () => {
    const max = await createActiveUser(db, 'Max', 'max@example.org')
    const louUser = await createActiveUser(db, 'Lou', 'lou@example.org')
    // Lou must see the item to write about it (ADR 0021).
    const collectif = await createActiveCollectif(db, 'Les Grenouilles', max.id)
    await setResponsible(db, { userId: louUser.id, collectifId: collectif.id, status: 'active' })
    const garage = await createTestLocation(db, { userId: max.id }, 'Garage')
    const item = await createTestItem(db, {
      locationId: garage.id,
      owner: { userId: max.id },
      createdBy: max.id,
    })
    const app = createTestApp(db, { rateLimits: defaultRateLimits })
    const lou = app.client()
    await signIn(app, lou, 'lou@example.org')
    app.mailer.outbox.length = 0

    const statuses = []
    for (let i = 0; i < 11; i++) {
      const url = routes.items.contact.href({ itemId: item.id })
      statuses.push((await lou.post(url, { message: `Message ${i}` })).status)
    }
    assert.deepEqual(statuses, [...Array(10).fill(303), 429])
    assert.equal(app.mailer.outbox.length, 10)
  })

  it('caps the requests that notify the admins: 5 a day per user', async () => {
    const rita = await createActiveUser(db, 'Rita', 'rita@example.org')
    await createActiveUser(db, 'Val', 'val@example.org')
    const collectif = await createActiveCollectif(db, 'Collectif C', rita.id)
    const app = createTestApp(db, { rateLimits: defaultRateLimits })
    const val = app.client()
    await signIn(app, val, 'val@example.org')

    for (let i = 0; i < 5; i++) {
      const response = await val.post(routes.collectifs.request.action.href(), {
        name: `Collectif ${i}`,
        city: 'Rennes',
      })
      assert.equal(response.status, 303)
    }
    const refused = await val.post(
      routes.collectifs.requestResponsibility.href({ slug: collectif.slug }),
    )
    assert.equal(refused.status, 429)
    const val2 = await findUserByEmail(db, 'val@example.org')
    assert.equal(await findResponsible(db, String(val2?.id), collectif.id), null)
  })

  it('caps re-applications after a rejection', async () => {
    const camille = await createUser(db, { name: 'Camille', email: 'camille@example.org' })
    const app = createTestApp(db, {
      rateLimits: { ...defaultRateLimits, requestsPerUser: { limit: 1, windowSeconds: 3600 } },
    })
    const client = app.client()
    await setUserStatus(db, camille.id, 'rejected')
    await signIn(app, client, 'camille@example.org')

    assert.equal((await client.post(routes.account.reapply.href())).status, 303)
    await setUserStatus(db, camille.id, 'rejected')
    assert.equal((await client.post(routes.account.reapply.href())).status, 429)
    assert.equal((await findUserByEmail(db, 'camille@example.org'))?.status, 'rejected')
  })
})

describe('sign-in and sign-up timing (US-0.2.2, review F3)', () => {
  let db: Database

  before(async () => {
    db = await openTestDatabase()
  })
  beforeEach(async () => {
    await resetDatabase(db)
  })
  after(async () => {
    await db.close()
  })

  /** A mail server that holds every message until `release()`: a very slow SMTP. */
  function heldMailer() {
    const sent: Mail[] = []
    let release = () => {}
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const mailer: Mailer = {
      async send(mail) {
        await gate
        sent.push(mail)
      },
    }
    return { mailer, sent, release: () => release() }
  }

  it('answers before any e-mail is sent, whether the address has an account or not', async () => {
    await createActiveUser(db, 'Camille', 'camille@example.org')
    const { mailer, sent, release } = heldMailer()
    const background = createBackgroundTasks()
    const router = createAppRouter({
      db,
      mailer,
      settings: { appUrl: testOrigin, adminEmails: new Set(['admin@example.org']) },
      sessionSecret: 'test-secret-test-secret-test-secret',
      background,
    })
    // No `background`: the client returns as soon as the response does, like a browser.
    const client = new TestClient(router)

    const answers = []
    for (const [url, fields] of [
      [signInUrl, { email: 'camille@example.org' }],
      [signInUrl, { email: 'nobody@example.org' }],
      [signUpUrl, { name: 'Camille', email: 'camille@example.org' }],
      [signUpUrl, { name: 'New', email: 'new@example.org' }],
    ] as const) {
      const response = await client.post(url, fields)
      answers.push(`${response.status} ${response.location}`)
    }
    assert.equal(sent.length, 0, 'every answer came while the mail server was still busy')
    assert.deepEqual(answers, [
      `303 ${routes.signIn.sent.href()}`,
      `303 ${routes.signIn.sent.href()}`,
      `303 ${routes.signUp.sent.href()}`,
      `303 ${routes.signUp.sent.href()}`,
    ])

    release()
    await background.idle()
    assert.equal(sent.length, 4, 'link, "already registered", "request received", admins')
  })
})

describe('client address (ADR 0018)', () => {
  it('replaces any address the client tried to send itself', () => {
    const spoofed = new Request(testOrigin, { headers: { [clientAddressHeader]: '1.2.3.4' } })
    assert.equal(clientAddressOf(withClientAddress(spoofed, '203.0.113.9')), '203.0.113.9')
    assert.equal(clientAddressOf(new Request(testOrigin)), 'unknown')
  })
})
