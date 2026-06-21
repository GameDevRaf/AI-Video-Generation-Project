// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSubscribe = vi.fn()
const mockConfig = vi.fn()
vi.mock('@fal-ai/client', () => ({
  fal: { subscribe: mockSubscribe, config: mockConfig },
}))

describe('FalImageProvider', () => {
  beforeEach(() => vi.clearAllMocks())

  it('calls fal.config with per-call credentials (never at module level)', async () => {
    mockSubscribe.mockResolvedValueOnce({ data: { images: [{ url: 'https://cdn.fal.ai/img.png' }] } })
    const { FalImageProvider } = await import('../../../server/worker/providers/image/fal')
    const provider = new FalImageProvider()
    await provider.generate({ job: {} as never, apiKey: 'fal-key-123', model: 'fal-ai/flux-pro/v1.1', prompt: 'A sunset' })
    expect(mockConfig).toHaveBeenCalledWith({ credentials: 'fal-key-123' })
  })

  it('forwards model and prompt to fal.subscribe', async () => {
    mockSubscribe.mockResolvedValueOnce({ data: { images: [{ url: 'https://cdn.fal.ai/img.png' }] } })
    const { FalImageProvider } = await import('../../../server/worker/providers/image/fal')
    await new FalImageProvider().generate({ job: {} as never, apiKey: 'k', model: 'fal-ai/flux/dev', prompt: 'Red panda' })
    expect(mockSubscribe).toHaveBeenCalledWith('fal-ai/flux/dev', expect.objectContaining({
      input: expect.objectContaining({ prompt: 'Red panda' }),
    }))
  })

  it('returns imageUrl from result', async () => {
    mockSubscribe.mockResolvedValueOnce({ data: { images: [{ url: 'https://cdn.fal.ai/out.png' }] } })
    const { FalImageProvider } = await import('../../../server/worker/providers/image/fal')
    const result = await new FalImageProvider().generate({ job: {} as never, apiKey: 'k', model: 'm', prompt: 'p' })
    expect(result.imageUrl).toBe('https://cdn.fal.ai/out.png')
  })

  it('throws when no images in result', async () => {
    mockSubscribe.mockResolvedValueOnce({ data: { images: [] } })
    const { FalImageProvider } = await import('../../../server/worker/providers/image/fal')
    await expect(
      new FalImageProvider().generate({ job: {} as never, apiKey: 'k', model: 'm', prompt: 'p' })
    ).rejects.toThrow('fal.ai returned no image URL')
  })
})
