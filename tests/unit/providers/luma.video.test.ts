// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mockGet = vi.fn()
const mockGenCreate = vi.fn()
vi.mock('lumaai', () => ({
  default: class {
    generations = { create: mockGenCreate, get: mockGet }
  },
}))

describe('LumaVideoProvider', () => {
  beforeEach(() => {
    vi.resetAllMocks()  // resetAllMocks clears mock queues — needed to prevent cross-test mock leakage
    vi.useFakeTimers()
  })
  afterEach(() => vi.useRealTimers())

  it('calls generations.create with model and prompt', async () => {
    vi.useRealTimers()
    mockGenCreate.mockResolvedValueOnce({ id: 'gen-1', state: 'dreaming' })
    mockGet.mockResolvedValueOnce({ id: 'gen-1', state: 'completed', assets: { video: 'https://luma.ai/v.mp4' } })

    const { LumaVideoProvider } = await import('../../../server/worker/providers/video/luma')
    const promise = new LumaVideoProvider().generate({
      job: {} as never, apiKey: 'luma-key', model: 'ray-2', prompt: 'Timelapse',
    })
    // Even with real timers, advance so setTimeout fires quickly in test
    await new Promise(r => setTimeout(r, 3_100))
    const result = await promise
    expect(mockGenCreate).toHaveBeenCalledWith(expect.objectContaining({ model: 'ray-2', prompt: 'Timelapse' }))
    expect(result.videoUrl).toBe('https://luma.ai/v.mp4')
  }, 10_000)

  it('rounds a fractional duration to the nearest integer second', async () => {
    mockGenCreate.mockResolvedValueOnce({ id: 'gen-4', state: 'dreaming' })
    mockGet.mockResolvedValueOnce({ id: 'gen-4', state: 'completed', assets: { video: 'https://luma.ai/v.mp4' } })

    const { LumaVideoProvider } = await import('../../../server/worker/providers/video/luma')
    const promise = new LumaVideoProvider().generate({
      job: {} as never, apiKey: 'k', model: 'ray-2', prompt: 'p', duration: 4.4,
    })
    await vi.advanceTimersByTimeAsync(4_000)
    await promise
    expect(mockGenCreate).toHaveBeenCalledWith(expect.objectContaining({ duration: '4s' }))
  })

  it('polls until state is "completed" (fake timers)', async () => {
    mockGenCreate.mockResolvedValueOnce({ id: 'gen-2', state: 'dreaming' })
    mockGet
      .mockResolvedValueOnce({ id: 'gen-2', state: 'dreaming' })
      .mockResolvedValueOnce({ id: 'gen-2', state: 'dreaming' })
      .mockResolvedValueOnce({ id: 'gen-2', state: 'completed', assets: { video: 'https://luma.ai/v.mp4' } })

    const { LumaVideoProvider } = await import('../../../server/worker/providers/video/luma')
    const promise = new LumaVideoProvider().generate({
      job: {} as never, apiKey: 'k', model: 'ray-2', prompt: 'p',
    })

    // Advance 3 poll intervals (3 × 3s = 9s)
    await vi.advanceTimersByTimeAsync(4_000)
    await vi.advanceTimersByTimeAsync(4_000)
    await vi.advanceTimersByTimeAsync(4_000)
    const result = await promise
    expect(result.videoUrl).toBe('https://luma.ai/v.mp4')
    expect(mockGet).toHaveBeenCalledTimes(3)
  })

  it('throws when state is "failed" (fake timers)', async () => {
    mockGenCreate.mockResolvedValueOnce({ id: 'gen-3', state: 'dreaming' })
    mockGet.mockResolvedValueOnce({ id: 'gen-3', state: 'failed', failure_reason: 'content policy' })

    const { LumaVideoProvider } = await import('../../../server/worker/providers/video/luma')
    // Attach assertion before advancing timers to avoid unhandled rejection warning
    const assertion = expect(
      new LumaVideoProvider().generate({ job: {} as never, apiKey: 'k', model: 'ray-2', prompt: 'p' })
    ).rejects.toThrow('content policy')
    await vi.advanceTimersByTimeAsync(4_000)
    await assertion
  })
})
