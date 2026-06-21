// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

describe('ReplicateImageProvider', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates prediction with correct owner/model path', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'pred-1', status: 'succeeded', output: ['https://cdn.replicate.com/out.jpg'] }),
    })
    const { ReplicateImageProvider } = await import('../../../server/worker/providers/image/replicate')
    await new ReplicateImageProvider().generate({
      job: {} as never, apiKey: 'rep-key', model: 'black-forest-labs/flux-schnell', prompt: 'A sunset',
    })
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.replicate.com/v1/models/black-forest-labs/flux-schnell/predictions',
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('polls until succeeded and returns imageUrl', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'pred-2', status: 'processing' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'pred-2', status: 'succeeded', output: ['https://img.example.com/a.jpg'] }),
      })
    const { ReplicateImageProvider } = await import('../../../server/worker/providers/image/replicate')
    const result = await new ReplicateImageProvider().generate({
      job: {} as never, apiKey: 'k', model: 'owner/model', prompt: 'p',
    })
    expect(result.imageUrl).toBe('https://img.example.com/a.jpg')
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it('throws on non-owner/model format', async () => {
    const { ReplicateImageProvider } = await import('../../../server/worker/providers/image/replicate')
    await expect(
      new ReplicateImageProvider().generate({ job: {} as never, apiKey: 'k', model: 'badmodel', prompt: 'p' })
    ).rejects.toThrow('owner/model-name')
  })

  it('throws on failed prediction', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'pred-3', status: 'failed', error: 'NSFW content' }),
    })
    const { ReplicateImageProvider } = await import('../../../server/worker/providers/image/replicate')
    await expect(
      new ReplicateImageProvider().generate({ job: {} as never, apiKey: 'k', model: 'a/b', prompt: 'p' })
    ).rejects.toThrow('NSFW content')
  })
})
