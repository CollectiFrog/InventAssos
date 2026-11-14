// Browser (e2e) test helpers: the real router behind a local HTTP server, driven by Playwright.

import type { Page } from 'playwright'
import type { Database } from 'remix/data-table'
import { createTestServer, type TestServer } from 'remix/node-fetch-server/test'

import { createTestApp, type TestApp, type TestAppOptions } from './app.ts'
import { lastSignInToken } from './auth.ts'

/** Starts the app on a random local port; its APP_URL is that port, so CSRF checks pass. */
export async function startBrowserApp(
  db: Database,
  options: Omit<TestAppOptions, 'appUrl'> = {},
): Promise<{ app: TestApp; server: TestServer }> {
  let app: TestApp | null = null
  const server = await createTestServer((request) => {
    if (app === null) return new Response('Starting', { status: 503 })
    return app.router.fetch(request)
  })
  app = createTestApp(db, { ...options, appUrl: server.baseUrl })
  return { app, server }
}

/** Signs in through the pages, like a person: e-mail form, then the link from the e-mail. */
export async function signInWithBrowser(page: Page, app: TestApp, email: string): Promise<void> {
  await page.goto('/connexion')
  await page.getByLabel('Adresse e-mail').fill(email)
  await page.getByRole('button', { name: 'Recevoir un lien par e-mail' }).click()
  await page.waitForURL('**/connexion/envoyee')
  await app.background.idle()
  const token = lastSignInToken(app, email)
  if (token === null) throw new Error(`no sign-in e-mail for ${email}`)
  await page.goto(`/connexion/lien/${token}`)
  await page.waitForURL((url) => !url.pathname.startsWith('/connexion'))
}
