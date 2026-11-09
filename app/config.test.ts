import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { loadConfig, parseEmailList } from './config.ts'

const base = {
  DATABASE_URL: 'postgres://localhost/x',
  SESSION_SECRET: 'x'.repeat(32),
}

describe('configuration', () => {
  it('defaults APP_URL to localhost outside production and logs e-mails', () => {
    const config = loadConfig({ ...base, PORT: '4000' })

    assert.equal(config.appUrl, 'http://localhost:4000')
    assert.equal(config.smtpUrl, null)
  })

  it('requires APP_URL and SMTP_URL in production', () => {
    assert.throws(() => loadConfig({ ...base, NODE_ENV: 'production' }), /APP_URL.*SMTP_URL/)
  })

  it('refuses a short session secret', () => {
    assert.throws(() => loadConfig({ ...base, SESSION_SECRET: 'short' }), /SESSION_SECRET/)
  })

  it('trusts forwarded client addresses only when TRUST_PROXY is true', () => {
    assert.equal(loadConfig(base).trustProxy, false)
    assert.equal(loadConfig({ ...base, TRUST_PROXY: 'true' }).trustProxy, true)
    assert.throws(() => loadConfig({ ...base, TRUST_PROXY: 'yes' }), /TRUST_PROXY/)
  })

  it('parses admin e-mails, ignoring case and blanks', () => {
    assert.deepEqual([...parseEmailList(' A@x.org, ,b@X.org ')], ['a@x.org', 'b@x.org'])
  })
})
