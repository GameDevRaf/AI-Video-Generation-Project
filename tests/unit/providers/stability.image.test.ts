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

  it('appends model=sd3.5-large to the form when the SD3.5 model is selected', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
      headers: { get: () => 'image/png' },
    })
    vi.stubGlobal('fetch', mockFetch)
    const { StabilityImageProvider } = await import('../../../server/worker/providers/image/stability')
    await new StabilityImageProvider().generate({
      job: {} as never, apiKey: 'k', model: 'stable-diffusion-3-5-large', prompt: 'p',
    })
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://api.stability.ai/v2beta/stable-image/generate/sd3')
    const form = init.body as FormData
    expect(form.get('model')).toBe('sd3.5-large')
    vi.unstubAllGlobals()
  })

  it('does not append a model field for the default (core) endpoint', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
      headers: { get: () => 'image/png' },
    })
    vi.stubGlobal('fetch', mockFetch)
    const { StabilityImageProvider } = await import('../../../server/worker/providers/image/stability')
    await new StabilityImageProvider().generate({
      job: {} as never, apiKey: 'k', model: 'stable-image-core', prompt: 'p',
    })
    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit]
    const form = init.body as FormData
    expect(form.get('model')).toBeNull()
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
