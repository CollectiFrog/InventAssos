// Signs a test client in through the real e-mail link flow.
import * as assert from 'remix/assert'

import type { TestApp, TestClient } from './app.ts'

/** Extracts the sign-in token from the last e-mail sent to `email`. */
export function lastSignInToken(app: TestApp, email: string): string | null {
  const mail = app.mailer.outbox.findLast(
    (m) => m.to === email && /lien de connexion/.test(m.subject),
  )
  return mail ? (/\/connexion\/lien\/([\w-]+)/.exec(mail.text)?.[1] ?? null) : null
}

/** Requests a link for `email` and follows it; asserts that the sign-in succeeded. */
export async function signIn(app: TestApp, client: TestClient, email: string): Promise<void> {
  await client.post('/connexion', { email })
  const token = lastSignInToken(app, email)
  assert.ok(token, `expected a sign-in e-mail for ${email}`)
  const response = await client.post(`/connexion/lien/${token}`)
  assert.equal(response.status, 303, 'sign-in link should redirect')
  // Follow the redirects like a browser: the CSRF token changes at sign-in.
  let next = response.location
  for (let hop = 0; next !== null && hop < 3; hop++) next = (await client.get(next)).location
}
