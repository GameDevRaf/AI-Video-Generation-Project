// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

describe('ReplicateVideoProvider', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.useFakeTimers()
  })
  afterEach(() => vi.useRealTimers())

  it('creates prediction for correct owner/model endpoint', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'v-1', status: 'succeeded', output: ['https://delivery.replicate.com/vid.mp4'] }),
    })
    const { ReplicateVideoProvider } = await import('../../../server/worker/providers/video/replicate_video')
    const result = await new ReplicateVideoProvider().generate({
      job: {} as never, apiKey: 'rep-key', model: 'minimax/video-01-live',
      prompt: 'A video', duration: 5,    })
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.replicate.com/v1/models/minimax/video-01-live/predictions',
      expect.objectContaining({ method: 'POST' }),
    )
    expect(result.videoUrl).toBe('https://delivery.replicate.com/vid.mp4')
  })

  it('polls until succeeded and returns videoUrl (fake timers)', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'v-2', status: 'starting' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'v-2', status: 'succeeded', output: ['https://cdn.replicate.com/x.mp4'] }) })

    const { ReplicateVideoProvider } = await import('../../../server/worker/providers/video/replicate_video')
    const promise = new ReplicateVideoProvider().generate({
      job: {} as never, apiKey: 'k', model: 'minimax/video-01-live',
      prompt: 'p', duration: 5,    })

    await vi.advanceTimersByTimeAsync(5_500)
    const result = await promise
    expect(result.videoUrl).toBe('https://cdn.replicate.com/x.mp4')
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it('rounds a fractional duration to the nearest integer second', async () => {
    let sentBody: { input?: { duration?: number } } = {}
    mockFetch.mockImplementationOnce(async (_url: string, init: RequestInit) => {
      sentBody = JSON.parse(init.body as string)
      return { ok: true, json: async () => ({ id: 'v-4', status: 'succeeded', output: ['https://delivery.replicate.com/vid.mp4'] }) }
    })
    const { ReplicateVideoProvider } = await import('../../../server/worker/providers/video/replicate_video')
    await new ReplicateVideoProvider().generate({
      job: {} as never, apiKey: 'k', model: 'minimax/video-01-live',
      prompt: 'p', duration: 4.2,    })
    expect(sentBody.input?.duration).toBe(4)
  })

  it('throws on bad model format', async () => {
    const { ReplicateVideoProvider } = await import('../../../server/worker/providers/video/replicate_video')
    await expect(
      new ReplicateVideoProvider().generate({
        job: {} as never, apiKey: 'k', model: 'noowner', prompt: 'p', duration: 5,      })
    ).rejects.toThrow('owner/model-name')
  })

  it('throws on failed status', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'v-3', status: 'failed', error: 'Timeout' }),
    })
    const { ReplicateVideoProvider } = await import('../../../server/worker/providers/video/replicate_video')
    const assertion = expect(
      new ReplicateVideoProvider().generate({
        job: {} as never, apiKey: 'k', model: 'a/b', prompt: 'p', duration: 5,      })
    ).rejects.toThrow('Timeout')
    await assertion
  })
})
