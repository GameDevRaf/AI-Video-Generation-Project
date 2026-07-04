// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('MiniMaxVideoProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('resolves with videoUrl after 3-step flow (create → poll → file retrieve)', async () => {
    let callCount = 0
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      callCount++
      if (url.includes('video_generation') && callCount === 1) {
        return { ok: true, json: async () => ({ task_id: 'mmtask-1' }) }
      }
      if (url.includes('query/video_generation')) {
        return { ok: true, json: async () => ({ task_result: { status: 'Success', file_id: 'file-1' } }) }
      }
      if (url.includes('files/retrieve')) {
        return { ok: true, json: async () => ({ file: { download_url: 'https://cdn.minimax.io/v.mp4' } }) }
      }
      return { ok: false }
    }))

    const { MiniMaxVideoProvider } = await import('../../../server/worker/providers/video/minimax')
    const promise = new MiniMaxVideoProvider().generate({
      job: {} as never, apiKey: 'mm-key', model: 'MiniMax-Hailuo-02', prompt: 'sunset',
    })
    await vi.runAllTimersAsync()
    const result = await promise
    expect(result.videoUrl).toBe('https://cdn.minimax.io/v.mp4')
  })

  it('throws on submit error', async () => {
    vi.useRealTimers()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false, status: 400, text: async () => 'bad request',
    }))
    const { MiniMaxVideoProvider } = await import('../../../server/worker/providers/video/minimax')
    await expect(
      new MiniMaxVideoProvider().generate({ job: {} as never, apiKey: 'k', model: 'm', prompt: 'p' })
    ).rejects.toThrow('MiniMax submit error 400')
  })

  it('sends duration 6 (not 5) and resolution 768P, with no aspect_ratio field', async () => {
    let sentBody: Record<string, unknown> = {}
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes('video_generation') && !url.includes('query')) {
        sentBody = JSON.parse(init!.body as string)
        return { ok: true, json: async () => ({ task_id: 'mmtask-3' }) }
      }
      if (url.includes('query/video_generation')) {
        return { ok: true, json: async () => ({ task_result: { status: 'Success', file_id: 'file-3' } }) }
      }
      if (url.includes('files/retrieve')) {
        return { ok: true, json: async () => ({ file: { download_url: 'https://cdn.minimax.io/v3.mp4' } }) }
      }
      return { ok: false }
    }))

    const { MiniMaxVideoProvider } = await import('../../../server/worker/providers/video/minimax')
    const promise = new MiniMaxVideoProvider().generate({
      job: {} as never, apiKey: 'k', model: 'MiniMax-Hailuo-02', prompt: 'p', duration: 5,
    })
    await vi.runAllTimersAsync()
    await promise

    expect(sentBody.duration).toBe(6)
    expect(sentBody.resolution).toBe('768P')
    expect(sentBody).not.toHaveProperty('aspect_ratio')
  })

  it('rounds up to duration 10 when requested duration is 8 or more', async () => {
    let sentBody: Record<string, unknown> = {}
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes('video_generation') && !url.includes('query')) {
        sentBody = JSON.parse(init!.body as string)
        return { ok: true, json: async () => ({ task_id: 'mmtask-4' }) }
      }
      if (url.includes('query/video_generation')) {
        return { ok: true, json: async () => ({ task_result: { status: 'Success', file_id: 'file-4' } }) }
      }
      if (url.includes('files/retrieve')) {
        return { ok: true, json: async () => ({ file: { download_url: 'https://cdn.minimax.io/v4.mp4' } }) }
      }
      return { ok: false }
    }))

    const { MiniMaxVideoProvider } = await import('../../../server/worker/providers/video/minimax')
    const promise = new MiniMaxVideoProvider().generate({
      job: {} as never, apiKey: 'k', model: 'MiniMax-Hailuo-2.3', prompt: 'p', duration: 9,
    })
    await vi.runAllTimersAsync()
    await promise

    expect(sentBody.duration).toBe(10)
  })

  it('throws when task_status is Fail', async () => {
    let callCount = 0
    vi.stubGlobal('fetch', vi.fn(async () => {
      callCount++
      if (callCount === 1) return { ok: true, json: async () => ({ task_id: 'mmtask-2' }) }
      return { ok: true, json: async () => ({ task_result: { status: 'Fail' } }) }
    }))
    const { MiniMaxVideoProvider } = await import('../../../server/worker/providers/video/minimax')
    // Attach assertion before advancing timers to avoid unhandled rejection warning
    const assertion = expect(
      new MiniMaxVideoProvider().generate({ job: {} as never, apiKey: 'k', model: 'm', prompt: 'p' })
    ).rejects.toThrow('MiniMax video generation failed')
    await vi.runAllTimersAsync()
    await assertion
  })
})
