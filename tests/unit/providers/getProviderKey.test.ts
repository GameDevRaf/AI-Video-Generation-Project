// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockDecrypt = vi.fn()
vi.mock('../../../server/utils/crypto', () => ({ decrypt: mockDecrypt }))

const mockSingle = vi.fn()
const mockFrom = vi.fn(() => ({
  select: () => ({ eq: () => ({ eq: () => ({ eq: () => ({ order: () => ({ limit: () => ({ single: mockSingle }) }) }) }) }) }),
}))
vi.mock('../../../server/worker/lib/supabase', () => ({
  adminSupabase: { from: mockFrom },
}))

describe('getProviderKey', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns the decrypted secret for an active key', async () => {
    mockSingle.mockResolvedValueOnce({ data: { encrypted_secret: 'enc-blob' }, error: null })
    mockDecrypt.mockReturnValueOnce('plain-api-key')

    const { getProviderKey } = await import('../../../server/worker/lib/getProviderKey')
    const result = await getProviderKey('anthropic', 'user-1')

    expect(mockDecrypt).toHaveBeenCalledWith('enc-blob')
    expect(result).toBe('plain-api-key')
  })

  it('throws when no active key exists for provider', async () => {
    mockSingle.mockResolvedValueOnce({ data: null, error: { message: 'not found' } })

    const { getProviderKey } = await import('../../../server/worker/lib/getProviderKey')
    await expect(getProviderKey('runway', 'user-1')).rejects.toThrow('No active API key found for provider "runway"')
  })

  it('queries by both provider and user_id', async () => {
    mockSingle.mockResolvedValueOnce({ data: { encrypted_secret: 'x' }, error: null })
    mockDecrypt.mockReturnValueOnce('key')

    const { getProviderKey } = await import('../../../server/worker/lib/getProviderKey')
    await getProviderKey('elevenlabs', 'user-42')

    expect(mockFrom).toHaveBeenCalledWith('api_keys')
  })
})
