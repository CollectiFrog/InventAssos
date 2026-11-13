// US-0.7.9, ADR 0024: axe-core audits the key pages at the three shell widths of ADR 0022.
// Any WCAG 2.1 A or AA violation fails the test, with the rule and the elements concerned.
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

import type { AxeResults } from 'axe-core'
import type { Page } from 'playwright'
import * as assert from 'remix/assert'
import type { Database } from 'remix/data-table'
import { after, before, beforeEach, describe, it } from 'remix/test'

import { signInWithBrowser, startBrowserApp } from '../test/browser.ts'
import { createActiveCollectif } from '../test/collectifs.ts'
import { openTestDatabase, resetDatabase } from '../test/database.ts'
import { createTestItem } from '../test/items.ts'
import { createTestLocation } from '../test/locations.ts'
import { createActiveUser } from '../test/users.ts'
import { createImport } from './data/imports.ts'

const widths = [
  { width: 390, height: 844 },
  { width: 1024, height: 768 },
  { width: 1440, height: 900 },
]

/** axe-core's browser build. Evaluated through Playwright: the app's CSP refuses injected scripts. */
const axeSource = readFileSync(
  createRequire(import.meta.url).resolve('axe-core/axe.min.js'),
  'utf8',
)

/** Violations of WCAG 2.1 A and AA on the page, as readable lines. */
async function violations(page: Page): Promise<string[]> {
  await page.evaluate(axeSource)
  const results = await page.evaluate(() =>
    (globalThis as unknown as { axe: { run(options: object): Promise<AxeResults> } }).axe.run({
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] },
    }),
  )
  return results.violations.map(
    (violation) =>
      `${violation.id} (${violation.impact}): ${violation.nodes.map((node) => node.target.join(' ')).join(', ')}`,
  )
}

/**
 * Controls smaller than 44 px on a phone (US-0.7.9): buttons, fields, menus and navigation links.
 * Links inside running text are exempt, as in WCAG 2.5.8.
 */
async function smallTargets(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const selector =
      'button, input:not([type=hidden]), select, textarea, summary, nav a, a.button, a.chip'
    return [...document.querySelectorAll<HTMLElement>(selector)]
      .filter((element) => element.offsetParent !== null)
      .filter((element) => {
        const box = element.getBoundingClientRect()
        // Half a pixel of slack: layout rounding gives 43.99 px for a 44 px control.
        return box.width > 0 && Math.min(box.height, box.width) < 43.5
      })
      .map((element) => {
        const text = (element.textContent ?? '').trim().slice(0, 30)
        const box = element.getBoundingClientRect()
        return `target-size-44: <${element.tagName.toLowerCase()} class="${element.className}"> « ${text} » ${Math.round(box.width)}×${Math.round(box.height)}`
      })
  })
}

/** Audits each path in turn and fails with every violation found, page by page. */
async function audit(page: Page, paths: string[]): Promise<void> {
  const found: string[] = []
  for (const path of paths) {
    await page.goto(path)
    for (const line of await violations(page)) found.push(`${path} → ${line}`)
    if ((page.viewportSize()?.width ?? 0) < 720) {
      for (const line of await smallTargets(page)) found.push(`${path} → ${line}`)
    }
  }
  assert.equal(found.length, 0, `\n${found.join('\n')}`)
}

describe('accessibility of the key pages (US-0.7.9)', () => {
  let db: Database
  let itemPath = ''
  let importPath = ''

  before(async () => {
    db = await openTestDatabase()
  })
  beforeEach(async () => {
    await resetDatabase(db)
    const rita = await createActiveUser(db, 'Rita Martin', 'rita@example.org')
    const frog = await createActiveCollectif(db, "Collecti'FROG", rita.id)
    const local = await createTestLocation(db, { collectifId: frog.id }, 'Local')
    await createTestLocation(db, { userId: rita.id }, 'Garage')
    for (const name of ['Console', 'Projecteur', 'Barnum']) {
      const item = await createTestItem(db, {
        locationId: local.id,
        owner: { collectifId: frog.id },
        createdBy: rita.id,
        name,
      })
      itemPath = `/materiel/${item.id}`
    }
    // An import in progress, with a column left « à vérifier » (US-0.10.1).
    const importId = await createImport(db, {
      createdBy: rita.id,
      locationId: local.id,
      fileName: 'inventaire.csv',
      header: ['Désignation', 'Qté', 'Bizarre'],
      rows: [
        { n: 2, cells: ['Lyre', '2', 'x'] },
        { n: 3, cells: ['Console', '1', ''] },
      ],
      columnMapping: ['name', 'quantity', null],
    })
    importPath = `/import/${importId}/colonnes`
  })
  after(async () => {
    await db.close()
  })

  for (const size of widths) {
    it(`visitor pages at ${size.width} px`, async (t) => {
      const { server } = await startBrowserApp(db)
      const page = await t.serve(server)
      await page.setViewportSize(size)
      await audit(page, ['/', '/connexion', '/inscription'])
    })

    it(`member pages at ${size.width} px`, async (t) => {
      const { app, server } = await startBrowserApp(db)
      const page = await t.serve(server)
      await page.setViewportSize(size)
      await signInWithBrowser(page, app, 'rita@example.org')
      await audit(page, [
        '/',
        '/inventaire',
        '/inventaire?vue=grille',
        '/materiel',
        '/lieux',
        '/materiel/nouveau',
        itemPath,
        '/collectifs',
        '/collectifs/collecti-frog',
        '/collectifs/collecti-frog/lieux',
        '/collectifs/collecti-frog/membres',
        '/compte/profil',
        '/compte/supprimer',
        '/import',
        importPath,
      ])
    })

    it(`administration at ${size.width} px`, async (t) => {
      const { app, server } = await startBrowserApp(db, { adminEmails: ['boss@example.org'] })
      const page = await t.serve(server)
      await page.setViewportSize(size)
      await signInWithBrowser(page, app, 'boss@example.org')
      await audit(page, [
        '/admin',
        '/admin/comptes',
        '/admin/collectifs',
        '/admin/moderateurs',
        '/admin/categories',
      ])
    })
  }

  it('member pages in the dark theme', async (t) => {
    const { app, server } = await startBrowserApp(db)
    const page = await t.serve(server)
    await page.emulateMedia({ colorScheme: 'dark' })
    await signInWithBrowser(page, app, 'rita@example.org')
    await audit(page, ['/', '/inventaire', itemPath, '/collectifs/collecti-frog', '/compte/profil'])
  })
})
