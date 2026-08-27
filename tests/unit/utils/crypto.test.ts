// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

// Must be set before the module is imported so derivedKey() resolves
const originalSecret = process.env.API_KEY_ENCRYPTION_SECRET
const originalServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

beforeAll(() => {
  process.env.API_KEY_ENCRYPTION_SECRET = 'test-api-key-encryption-secret-for-unit-tests'
})

afterAll(() => {
  if (originalSecret === undefined) delete process.env.API_KEY_ENCRYPTION_SECRET
  else process.env.API_KEY_ENCRYPTION_SECRET = originalSecret
  if (originalServiceRoleKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY
  else process.env.SUPABASE_SERVICE_ROLE_KEY = originalServiceRoleKey
})

describe('encrypt / decrypt', () => {
  it('round-trips a plain API key string', async () => {
    const { encrypt, decrypt } = await import('../../../server/utils/crypto')
    const original = 'sample-provider-api-key'
    expect(decrypt(encrypt(original))).toBe(original)
  })

  it('produces different ciphertext on each call due to random IV', async () => {
    const { encrypt } = await import('../../../server/utils/crypto')
    const cipherA = encrypt('same-value')
    const cipherB = encrypt('same-value')
    expect(cipherA).not.toBe(cipherB)
  })

  it('round-trips an empty string', async () => {
    const { encrypt, decrypt } = await import('../../../server/utils/crypto')
    expect(decrypt(encrypt(''))).toBe('')
  })

  it('stores result in iv:tag:ciphertext format', async () => {
    const { encrypt } = await import('../../../server/utils/crypto')
    const stored = encrypt('hello')
    const parts = stored.split(':')
    expect(parts).toHaveLength(3)
    // iv = 12 bytes → 24 hex chars, tag = 16 bytes → 32 hex chars
    expect(parts[0]).toHaveLength(24)
    expect(parts[1]).toHaveLength(32)
  })

  it('throws when ciphertext is tampered with', async () => {
    const { encrypt, decrypt } = await import('../../../server/utils/crypto')
    const stored = encrypt('secret-value')
    const [iv, tag, ct] = stored.split(':')
    // Replace the last hex char with a different one to guarantee tampering
    const lastChar = ct.slice(-1)
    const replacement = lastChar === 'f' ? '0' : 'f'
    const tampered = `${iv}:${tag}:${ct.slice(0, -1)}${replacement}`
    expect(() => decrypt(tampered)).toThrow()
  })

  it('fails closed when the encryption secret is missing, even if a service-role key exists', async () => {
    const { encrypt } = await import('../../../server/utils/crypto')
    const currentSecret = process.env.API_KEY_ENCRYPTION_SECRET
    const currentServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    delete process.env.API_KEY_ENCRYPTION_SECRET
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key-must-never-be-used-as-encryption-secret'

    expect(() => encrypt('secret-value')).toThrow('API_KEY_ENCRYPTION_SECRET must be set')
    if (currentSecret === undefined) delete process.env.API_KEY_ENCRYPTION_SECRET
    else process.env.API_KEY_ENCRYPTION_SECRET = currentSecret
    if (currentServiceRoleKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY
    else process.env.SUPABASE_SERVICE_ROLE_KEY = currentServiceRoleKey
  })
})
