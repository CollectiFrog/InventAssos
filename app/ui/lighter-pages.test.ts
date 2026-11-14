// ADR 0031: icon actions keep their names, the top bar's « + » follows the page, hints show on hover.
import * as assert from 'remix/assert'
import type { Database } from 'remix/data-table'
import { after, before, beforeEach, describe, it } from 'remix/test'

import { createTestApp, type TestApp, type TestClient } from '../../test/app.ts'
import { signIn } from '../../test/auth.ts'
import { createActiveCollectif } from '../../test/collectifs.ts'
import { openTestDatabase, resetDatabase } from '../../test/database.ts'
import { createTestItem } from '../../test/items.ts'
import { createTestLocation } from '../../test/locations.ts'
import { createActiveUser } from '../../test/users.ts'
import type { Collectif, Item } from '../data/tables.ts'
import { routes } from '../routes.ts'

/** The top bar's « + »: where it leads and what it says. */
function topAdd(html: string): { href: string; label: string } | null {
  const match = /<a href="([^"]+)" title="([^"]+)" class="button top-add icon-button">/.exec(html)
  const decode = (text = '') => text.replaceAll('&#x27;', "'").replaceAll('&#39;', "'")
  return match ? { href: decode(match[1]), label: decode(match[2]) } : null
}

describe('lighter pages (ADR 0031)', () => {
  let db: Database
  let app: TestApp
  let rita: TestClient
  let frog: Collectif
  let item: Item

  before(async () => {
    db = await openTestDatabase()
  })
  beforeEach(async () => {
    await resetDatabase(db)
    const user = await createActiveUser(db, 'Rita', 'rita@example.org')
    frog = await createActiveCollectif(db, "Collecti'FROG", user.id)
    const local = await createTestLocation(db, { collectifId: frog.id }, 'Local')
    item = await createTestItem(db, {
      locationId: local.id,
      owner: { collectifId: frog.id },
      createdBy: user.id,
      name: 'Console',
    })
    app = createTestApp(db)
    rita = app.client()
    await signIn(app, rita, 'rita@example.org')
  })
  after(async () => {
    await db.close()
  })

  it('shows an item’s actions as icons that keep their names, in one toolbar', async () => {
    const html = (await rita.get(routes.items.show.href({ itemId: item.id }))).text
    const toolbar = /<div class="icon-toolbar">(.*?)<\/div>/s.exec(html)?.[1] ?? ''
    for (const [label, href] of [
      ['Modifier', routes.items.edit.index.href({ itemId: item.id })],
      ['Déplacer', routes.items.move.index.href({ itemId: item.id })],
      ['Archiver', routes.items.archive.index.href({ itemId: item.id })],
      ['Supprimer…', routes.items.remove.index.href({ itemId: item.id })],
    ]) {
      assert.match(toolbar, new RegExp(`<a href="${href}" title="${label}"`), label)
      assert.match(toolbar, new RegExp(`<span class="visually-hidden">${label}</span>`), label)
    }
    assert.match(toolbar, /title="Supprimer…" class="button danger-icon icon-button"/)
    assert.doesNotMatch(html, /<div class="card">\s*<p class="actions">/)
  })

  it('makes the top bar’s « + » add equipment, to the collectif on its pages', async () => {
    const show = (await rita.get(routes.collectifs.show.href({ slug: frog.slug }))).text
    assert.deepEqual(topAdd(show), {
      href: `${routes.items.create.index.href()}?pour=collectif:${frog.id}`,
      label: "Ajouter du matériel à Collecti'FROG",
    })
    // The page no longer repeats it with its own button.
    assert.doesNotMatch(show, /class="button">\s*Ajouter du matériel/)
    const places = (await rita.get(routes.collectifs.places.href({ slug: frog.slug }))).text
    assert.equal(
      topAdd(places)?.href,
      `${routes.items.create.index.href()}?pour=collectif:${frog.id}`,
    )
    for (const url of [routes.home.href(), routes.locations.index.href()]) {
      assert.equal(topAdd((await rita.get(url)).text)?.label, 'Ajouter du matériel', url)
    }
  })

  it('adds a place with « + Lieu » in the page, never with the top bar’s « + »', async () => {
    const plusLieu = (href: string) =>
      new RegExp(
        `<a href="${href.replace('?', '\\?')}" title="[^"]+" class="button secondary icon-button with-text">.*?<span aria-hidden="true">Lieu</span>`,
        's',
      )
    const mine = (await rita.get(routes.locations.index.href())).text
    assert.match(mine, plusLieu(`${routes.locations.create.index.href()}?pour=me`))
    const places = (await rita.get(routes.collectifs.places.href({ slug: frog.slug }))).text
    assert.match(
      places,
      plusLieu(`${routes.locations.create.index.href()}?pour=collectif:${frog.id}`),
    )
  })

  it('shows a text hint on hover, still read by screen readers', async () => {
    const html = (await rita.get(routes.account.profile.index.href())).text
    const hint = /<p id="field-phone-hint" class="visually-hidden">([^<]+)<\/p>/.exec(html)?.[1]
    assert.ok(hint?.startsWith('Visible par les personnes de vos collectifs'))
    assert.match(html, new RegExp(`<span title="${hint}" class="hint-mark">`))
    assert.match(
      html,
      /<input id="field-phone"[^>]*title="Visible par[^"]*"[^>]*aria-describedby="field-phone-hint"/,
    )
  })

  it('keeps a hint holding a link on the page', async () => {
    const html = (await app.client().get(routes.signIn.form.index.href())).text
    assert.match(html, /<p id="field-password-hint" class="hint"><a href="\/mot-de-passe">/)
  })
})
