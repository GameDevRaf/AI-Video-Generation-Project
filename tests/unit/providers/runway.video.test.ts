// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mockRetrieve = vi.fn()
const mockCreate = vi.fn()
vi.mock('@runwayml/sdk', () => ({
  default: class {
    imageToVideo = { create: mockCreate }
    tasks = { retrieve: mockRetrieve }
  },
}))

describe('RunwayVideoProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })
  afterEach(() => vi.useRealTimers())

  it('calls imageToVideo.create with model and imageUrl', async () => {
    mockCreate.mockResolvedValueOnce({ id: 'task-1' })
    mockRetrieve.mockResolvedValueOnce({ status: 'SUCCEEDED', output: ['https://cdn.runway.com/video.mp4'] })
    const { RunwayVideoProvider } = await import('../../../server/worker/providers/video/runway')
    const p = new RunwayVideoProvider().generate({
      job: {} as never, apiKey: 'rw-key', model: 'gen4_turbo',
      prompt: 'Fly over ocean', imageUrl: 'https://img.example.com/frame.png',
    })
    await vi.runAllTimersAsync()
    await p
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
      model: 'gen4_turbo',
      promptImage: 'https://img.example.com/frame.png',
      promptText: 'Fly over ocean',
    }))
  })

  it('calls retrieve with the returned task id', async () => {
    mockCreate.mockResolvedValueOnce({ id: 'task-abc' })
    mockRetrieve.mockResolvedValueOnce({ status: 'SUCCEEDED', output: ['https://cdn.runway.com/v.mp4'] })
    const { RunwayVideoProvider } = await import('../../../server/worker/providers/video/runway')
    const p = new RunwayVideoProvider().generate({
      job: {} as never, apiKey: 'k', model: 'gen4_turbo',
      prompt: 'p', imageUrl: 'https://i.com/i.png',
    })
    await vi.runAllTimersAsync()
    await p
    expect(mockRetrieve).toHaveBeenCalledWith('task-abc')
  })

  it('returns videoUrl from output[0]', async () => {
    mockCreate.mockResolvedValueOnce({ id: 'task-1' })
    mockRetrieve.mockResolvedValueOnce({ status: 'SUCCEEDED', output: ['https://cdn.runway.com/result.mp4'] })
    const { RunwayVideoProvider } = await import('../../../server/worker/providers/video/runway')
    const p = new RunwayVideoProvider().generate({
      job: {} as never, apiKey: 'k', model: 'gen4_turbo',
      prompt: 'p', imageUrl: 'https://i.com/i.png',
    })
    await vi.runAllTimersAsync()
    const result = await p
    expect(result.videoUrl).toBe('https://cdn.runway.com/result.mp4')
  })

  it('rounds a fractional duration to the nearest integer second', async () => {
    mockCreate.mockResolvedValueOnce({ id: 'task-1' })
    mockRetrieve.mockResolvedValueOnce({ status: 'SUCCEEDED', output: ['https://cdn.runway.com/video.mp4'] })
    const { RunwayVideoProvider } = await import('../../../server/worker/providers/video/runway')
    const p = new RunwayVideoProvider().generate({
      job: {} as never, apiKey: 'k', model: 'gen4_turbo',
      prompt: 'p', imageUrl: 'https://i.com/i.png', duration: 6.7,
    })
    await vi.runAllTimersAsync()
    await p
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ duration: 7 }))
  })

  it('throws when imageUrl is missing', async () => {
    const { RunwayVideoProvider } = await import('../../../server/worker/providers/video/runway')
    await expect(
      new RunwayVideoProvider().generate({ job: {} as never, apiKey: 'k', model: 'm', prompt: 'p' })
    ).rejects.toThrow('imageUrl')
  })
})
