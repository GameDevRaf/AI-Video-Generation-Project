// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockWait = vi.fn()
const mockCreate = vi.fn()
vi.mock('@runwayml/sdk', () => ({
  default: class {
    imageToVideo = { create: mockCreate }
    tasks = { waitForTaskOutput: mockWait }
  },
}))

describe('RunwayVideoProvider', () => {
  beforeEach(() => vi.clearAllMocks())

  it('calls imageToVideo.create with model and imageUrl', async () => {
    mockCreate.mockResolvedValueOnce({ id: 'task-1' })
    mockWait.mockResolvedValueOnce({ output: ['https://cdn.runway.com/video.mp4'] })
    const { RunwayVideoProvider } = await import('../../../server/worker/providers/video/runway')
    await new RunwayVideoProvider().generate({
      job: {} as never, apiKey: 'rw-key', model: 'gen4_turbo',
      prompt: 'Fly over ocean', imageUrl: 'https://img.example.com/frame.png',
    })
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
      model: 'gen4_turbo',
      promptImage: 'https://img.example.com/frame.png',
      promptText: 'Fly over ocean',
    }))
  })

  it('calls waitForTaskOutput with the returned task id', async () => {
    mockCreate.mockResolvedValueOnce({ id: 'task-abc' })
    mockWait.mockResolvedValueOnce({ output: ['https://cdn.runway.com/v.mp4'] })
    const { RunwayVideoProvider } = await import('../../../server/worker/providers/video/runway')
    await new RunwayVideoProvider().generate({
      job: {} as never, apiKey: 'k', model: 'gen4_turbo',
      prompt: 'p', imageUrl: 'https://i.com/i.png',
    })
    expect(mockWait).toHaveBeenCalledWith('task-abc')
  })

  it('returns videoUrl from output[0]', async () => {
    mockCreate.mockResolvedValueOnce({ id: 'task-1' })
    mockWait.mockResolvedValueOnce({ output: ['https://cdn.runway.com/result.mp4'] })
    const { RunwayVideoProvider } = await import('../../../server/worker/providers/video/runway')
    const result = await new RunwayVideoProvider().generate({
      job: {} as never, apiKey: 'k', model: 'gen4_turbo',
      prompt: 'p', imageUrl: 'https://i.com/i.png',
    })
    expect(result.videoUrl).toBe('https://cdn.runway.com/result.mp4')
  })

  it('throws when imageUrl is missing', async () => {
    const { RunwayVideoProvider } = await import('../../../server/worker/providers/video/runway')
    await expect(
      new RunwayVideoProvider().generate({ job: {} as never, apiKey: 'k', model: 'm', prompt: 'p' })
    ).rejects.toThrow('imageUrl')
  })
})
