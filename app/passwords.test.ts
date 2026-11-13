import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import { hashPassword, passwordProblem, verifyPassword } from './passwords.ts'

describe('passwords (ADR 0029)', () => {
  it('accepts the right password and refuses any other', async () => {
    const hash = await hashPassword('une phrase assez longue')
    assert.match(hash, /^scrypt\$32768\$8\$3\$[\w-]+\$[\w-]+$/)
    assert.equal(await verifyPassword('une phrase assez longue', hash), true)
    assert.equal(await verifyPassword('une phrase assez longuE', hash), false)
    assert.equal(await verifyPassword('', hash), false)
  })

  it('salts every hash', async () => {
    assert.notEqual(
      await hashPassword('même mot de passe'),
      await hashPassword('même mot de passe'),
    )
  })

  it('answers false without a stored hash, or with a malformed one', async () => {
    assert.equal(await verifyPassword('une phrase assez longue', null), false)
    assert.equal(await verifyPassword('une phrase assez longue', 'md5$abc'), false)
  })

  it('compares the same text however its accents were typed (NFC)', async () => {
    const hash = await hashPassword('café au lait chaud')
    assert.equal(await verifyPassword('café au lait chaud', hash), true)
  })

  it('asks for 12 to 128 characters, nothing else', () => {
    assert.match(passwordProblem('court') ?? '', /au moins 12 caractères/)
    assert.equal(passwordProblem('douze caract'), null)
    assert.equal(passwordProblem('ééééééééééé'), passwordProblem('court'))
    assert.equal(passwordProblem('a'.repeat(128)), null)
    assert.match(passwordProblem('a'.repeat(129)) ?? '', /Pas plus de 128/)
  })
})
