// Builds the real router with test doubles, plus a small cookie-keeping client.
import type { Database } from 'remix/data-table'

import { type BackgroundTasks, createBackgroundTasks } from '../app/background.ts'
import { clientAddressHeader } from '../app/client-address.ts'
import type { RateLimit } from '../app/data/rate-limits.ts'
import { defaultRateLimits, type RateLimits } from '../app/rate-limits.ts'
import { createAppRouter } from '../app/router.ts'
import { createTestMailer, type TestMailer } from './mailer.ts'

/** Origin of every test request; also the app's APP_URL in tests. */
export const testOrigin = 'http://inventassos.test'

/** Options of `createTestApp`. */
export interface TestAppOptions {
  adminEmails?: string[]
  /** Defaults to `relaxedRateLimits`; pass `defaultRateLimits` to test the real ones. */
  rateLimits?: RateLimits
}

const relaxed: RateLimit = { limit: 10_000, windowSeconds: 60 }

/** Limits no ordinary test reaches: tests sign in many times from one "client". */
export const relaxedRateLimits: RateLimits = Object.fromEntries(
  Object.keys(defaultRateLimits).map((name) => [name, relaxed]),
) as unknown as RateLimits

/** The router under test and the doubles it was built with. */
export interface TestApp {
  router: ReturnType<typeof createAppRouter>
  mailer: TestMailer
  /** Work left after a response; the test client waits for it, like a user reading their mail. */
  background: BackgroundTasks
  /** A fresh client with its own cookies, like a separate browser; `address` is its network address. */
  client(options?: { address?: string }): TestClient
}

/** Builds the application router on the test database. */
export function createTestApp(db: Database, options: TestAppOptions = {}): TestApp {
  const mailer = createTestMailer()
  const background = createBackgroundTasks()
  const router = createAppRouter({
    db,
    mailer,
    settings: {
      appUrl: testOrigin,
      adminEmails: new Set(options.adminEmails?.map((email) => email.toLowerCase()) ?? []),
      rateLimits: options.rateLimits ?? relaxedRateLimits,
    },
    sessionSecret: 'test-secret-test-secret-test-secret',
    background,
  })
  return {
    router,
    mailer,
    background,
    client: (options) => new TestClient(router, background, options?.address),
  }
}

/** Sends requests like a browser: keeps cookies and the last CSRF token it saw. */
export class TestClient {
  #router: TestApp['router']
  #background: BackgroundTasks | null
  #address: string | undefined
  #cookies = new Map<string, string>()
  #csrfToken: string | null = null

  constructor(
    router: TestApp['router'],
    background: BackgroundTasks | null = null,
    address?: string,
  ) {
    this.#router = router
    this.#background = background
    this.#address = address
  }

  /** GET a path; HTML bodies are read so their CSRF token is remembered. */
  async get(path: string): Promise<TestResponse> {
    return this.#send(new Request(new URL(path, testOrigin), { headers: this.#headers() }))
  }

  /** POST a form with the remembered CSRF token (fetching one from `csrfFrom` if needed). */
  async post(
    path: string,
    fields: Record<string, string> = {},
    options: { csrf?: boolean; csrfFrom?: string } = {},
  ): Promise<TestResponse> {
    const body = new FormData()
    for (const [name, value] of Object.entries(fields)) body.set(name, value)
    if (options.csrf !== false) {
      if (this.#csrfToken === null) await this.get(options.csrfFrom ?? '/connexion')
      body.set('_csrf', this.#csrfToken ?? '')
    }
    const headers = this.#headers()
    headers.set('Origin', testOrigin)
    return this.#send(new Request(new URL(path, testOrigin), { method: 'POST', body, headers }))
  }

  /** The Cookie header this client would send, e.g. to replay it from elsewhere. */
  cookieHeader(): string {
    return this.#headers().get('Cookie') ?? ''
  }

  /** Forgets every cookie, like closing a private window. */
  clearCookies(): void {
    this.#cookies.clear()
    this.#csrfToken = null
  }

  #headers(): Headers {
    const headers = new Headers()
    const cookie = [...this.#cookies].map(([name, value]) => `${name}=${value}`).join('; ')
    if (cookie) headers.set('Cookie', cookie)
    // What server.ts sets from the socket in production (app/client-address.ts).
    if (this.#address) headers.set(clientAddressHeader, this.#address)
    return headers
  }

  async #send(request: Request): Promise<TestResponse> {
    const response = await this.#router.fetch(request)
    await this.#background?.idle()
    for (const header of response.headers.getSetCookie()) {
      const [pair = ''] = header.split(';', 1)
      const index = pair.indexOf('=')
      const name = pair.slice(0, index)
      const value = pair.slice(index + 1)
      if (value === '' || /max-age=0|expires=thu, 01 jan 1970/i.test(header)) {
        this.#cookies.delete(name)
      } else {
        this.#cookies.set(name, value)
      }
    }
    const text = await response.text()
    const token = /name="_csrf" value="([^"]+)"/.exec(text)?.[1]
    if (token) this.#csrfToken = token
    return {
      status: response.status,
      headers: response.headers,
      text,
      location: response.headers.get('Location'),
    }
  }
}

/** A response whose body was already read. */
export interface TestResponse {
  status: number
  headers: Headers
  text: string
  location: string | null
}
