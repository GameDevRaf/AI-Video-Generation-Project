// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSubscribe = vi.fn()
const mockConfig = vi.fn()
vi.mock('@fal-ai/client', () => ({
  fal: { subscribe: mockSubscribe, config: mockConfig },
}))

describe('FalVideoProvider', () => {
  beforeEach(() => vi.clearAllMocks())

  it('calls fal.config with per-call credentials', async () => {
    mockSubscribe.mockResolvedValueOnce({ data: { video: { url: 'https://cdn.fal.ai/v.mp4' } } })
    const { FalVideoProvider } = await import('../../../server/worker/providers/video/fal_video')
    await new FalVideoProvider().generate({ job: {} as never, apiKey: 'fal-key', model: 'fal-ai/pika/v2.2', prompt: 'p' })
    expect(mockConfig).toHaveBeenCalledWith({ credentials: 'fal-key' })
  })

  it('uses the image-to-video endpoint when imageUrl is present', async () => {
    mockSubscribe.mockResolvedValueOnce({ data: { video: { url: 'https://cdn.fal.ai/v.mp4' } } })
    const { FalVideoProvider } = await import('../../../server/worker/providers/video/fal_video')
    await new FalVideoProvider().generate({
      job: {} as never, apiKey: 'k', model: 'fal-ai/pika/v2.2', prompt: 'p', imageUrl: 'https://img.example/1.png',
    })
    expect(mockSubscribe).toHaveBeenCalledWith(
      'fal-ai/pika/v2.2/image-to-video',
      expect.objectContaining({ input: expect.objectContaining({ image_url: 'https://img.example/1.png' }) }),
    )
  })

  it('uses the text-to-video endpoint when no imageUrl is given', async () => {
    mockSubscribe.mockResolvedValueOnce({ data: { video: { url: 'https://cdn.fal.ai/v.mp4' } } })
    const { FalVideoProvider } = await import('../../../server/worker/providers/video/fal_video')
    await new FalVideoProvider().generate({ job: {} as never, apiKey: 'k', model: 'fal-ai/pika/v2.2', prompt: 'p' })
    expect(mockSubscribe).toHaveBeenCalledWith('fal-ai/pika/v2.2/text-to-video', expect.anything())
  })

  it('maps the MiniMax model to its endpoint pair (no suffix for text-to-video)', async () => {
    mockSubscribe.mockResolvedValueOnce({ data: { video: { url: 'https://cdn.fal.ai/v.mp4' } } })
    const { FalVideoProvider } = await import('../../../server/worker/providers/video/fal_video')
    await new FalVideoProvider().generate({ job: {} as never, apiKey: 'k', model: 'fal-ai/minimax/video-01', prompt: 'p' })
    expect(mockSubscribe).toHaveBeenCalledWith('fal-ai/minimax/video-01', expect.anything())

    mockSubscribe.mockResolvedValueOnce({ data: { video: { url: 'https://cdn.fal.ai/v2.mp4' } } })
    await new FalVideoProvider().generate({
      job: {} as never, apiKey: 'k', model: 'fal-ai/minimax/video-01', prompt: 'p', imageUrl: 'https://img.example/1.png',
    })
    expect(mockSubscribe).toHaveBeenCalledWith('fal-ai/minimax/video-01/image-to-video', expect.anything())
  })

  it('returns videoUrl from result', async () => {
    mockSubscribe.mockResolvedValueOnce({ data: { video: { url: 'https://cdn.fal.ai/out.mp4' } } })
    const { FalVideoProvider } = await import('../../../server/worker/providers/video/fal_video')
    const result = await new FalVideoProvider().generate({ job: {} as never, apiKey: 'k', model: 'fal-ai/pika/v2.2', prompt: 'p' })
    expect(result.videoUrl).toBe('https://cdn.fal.ai/out.mp4')
  })

  it('throws on an unknown model id', async () => {
    const { FalVideoProvider } = await import('../../../server/worker/providers/video/fal_video')
    await expect(
      new FalVideoProvider().generate({ job: {} as never, apiKey: 'k', model: 'fal-ai/unknown/model', prompt: 'p' })
    ).rejects.toThrow('Unknown fal.ai video model')
  })

  it('throws when no video URL in result', async () => {
    mockSubscribe.mockResolvedValueOnce({ data: {} })
    const { FalVideoProvider } = await import('../../../server/worker/providers/video/fal_video')
    await expect(
      new FalVideoProvider().generate({ job: {} as never, apiKey: 'k', model: 'fal-ai/pika/v2.2', prompt: 'p' })
    ).rejects.toThrow('returned no video URL')
  })
})
