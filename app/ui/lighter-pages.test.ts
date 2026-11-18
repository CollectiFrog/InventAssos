// ADR 0031 and 0037: icon actions keep their names, adding is in the pages, hints show on hover.
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

  it('adds equipment with « + Matériel » in the page, and the top bar has no « + » (ADR 0037)', async () => {
    const mine = (await rita.get(routes.items.index.href())).text
    assert.match(
      mine,
      /<a href="\/materiel\/nouveau" title="Ajouter du matériel" class="button secondary icon-button with-text">.*?<span aria-hidden="true">Matériel<\/span>/s,
    )
    for (const url of [routes.home.href(), routes.collectifs.show.href({ slug: frog.slug })]) {
      assert.doesNotMatch((await rita.get(url)).text, /top-add/, url)
    }
  })

  it('adds a place with « + Lieu » in the page', async () => {
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
    const html = (await rita.get(`${routes.account.profile.index.href()}?modifier=telephone`)).text
    const hint = /<p id="field-phone-hint" class="visually-hidden">([^<]+)<\/p>/.exec(html)?.[1]
    assert.ok(hint?.startsWith('Visible par les personnes de vos collectifs'))
    assert.match(html, new RegExp(`<span title="${hint}" class="hint-mark">`))
    assert.match(
      html,
      /<input id="field-phone"[^>]*title="Visible par[^"]*"[^>]*aria-describedby="field-phone-hint"/,
    )
  })

  it('puts « Mot de passe oublié ? » on the label’s line, outside the label (US-0.10.17)', async () => {
    const html = (await app.client().get(routes.signIn.form.index.href())).text
    assert.match(
      html,
      /<div class="label-row"><label for="field-password">Mot de passe<\/label><a href="\/mot-de-passe">Mot de passe oublié \?<\/a><\/div>/,
    )
  })
})
