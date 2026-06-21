// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('StabilityImageProvider', () => {
  beforeEach(() => vi.clearAllMocks())

  it('sends Authorization: Bearer header', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
      headers: { get: () => 'image/png' },
    })
    vi.stubGlobal('fetch', mockFetch)

    const { StabilityImageProvider } = await import('../../../server/worker/providers/image/stability')
    await new StabilityImageProvider().generate({ job: {} as never, apiKey: 'stab-key', model: 'stable-image-core', prompt: 'Mountain' })

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer stab-key')
    vi.unstubAllGlobals()
  })

  it('sends Accept: image/* header', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
      headers: { get: () => 'image/png' },
    })
    vi.stubGlobal('fetch', mockFetch)
    const { StabilityImageProvider } = await import('../../../server/worker/providers/image/stability')
    await new StabilityImageProvider().generate({ job: {} as never, apiKey: 'k', model: 'stable-image-core', prompt: 'p' })
    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect((init.headers as Record<string, string>)['Accept']).toBe('image/*')
    vi.unstubAllGlobals()
  })

  it('returns rawBuffer instead of imageUrl', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(Buffer.from('PNG_BYTES').buffer),
      headers: { get: () => 'image/png' },
    }))
    const { StabilityImageProvider } = await import('../../../server/worker/providers/image/stability')
    const result = await new StabilityImageProvider().generate({ job: {} as never, apiKey: 'k', model: 'stable-image-core', prompt: 'p' })
    expect(result.rawBuffer).toBeInstanceOf(Buffer)
    expect(result.imageUrl).toBeUndefined()
    vi.unstubAllGlobals()
  })

  it('throws on non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 402,
      text: () => Promise.resolve('payment required'),
      headers: { get: () => null },
    }))
    const { StabilityImageProvider } = await import('../../../server/worker/providers/image/stability')
    await expect(
      new StabilityImageProvider().generate({ job: {} as never, apiKey: 'k', model: 'stable-image-core', prompt: 'p' })
    ).rejects.toThrow('Stability AI error 402')
    vi.unstubAllGlobals()
  })
})
