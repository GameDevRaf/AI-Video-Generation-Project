// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const CREDS = { ak: 'kling-ak', sk: 'kling-sk' }

// Mock jose so JWT generation returns instantly (no crypto timing involved)
vi.mock('jose', () => ({
  SignJWT: class {
    _payload: Record<string, unknown> = {}
    constructor(payload: Record<string, unknown>) { this._payload = payload }
    setProtectedHeader() { return this }
    async sign() { return 'mock.kling.jwt' }
  },
}))

describe('KlingVideoProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('throws when credentials are not valid JSON', async () => {
    vi.useRealTimers()
    const { KlingVideoProvider } = await import('../../../server/worker/providers/video/kling')
    await expect(
      new KlingVideoProvider().generate({ job: {} as never, apiKey: 'bad', model: 'm', prompt: 'p' })
    ).rejects.toThrow('Kling credentials must be stored as JSON')
  })

  it('includes JWT Authorization: Bearer header on create request', async () => {
    const calls: [string, RequestInit][] = []
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
      calls.push([url, init])
      if (init?.method === 'POST') {
        return { ok: true, json: async () => ({ data: { task_id: 'task-1' } }) }
      }
      return { ok: true, json: async () => ({ data: { task_status: 'succeed', task_result: { videos: [{ url: 'https://klingai.com/v.mp4' }] } } }) }
    }))

    const { KlingVideoProvider } = await import('../../../server/worker/providers/video/kling')
    const promise = new KlingVideoProvider().generate({
      job: {} as never, apiKey: JSON.stringify(CREDS), model: 'kling-v2-master', prompt: 'p',
    })

    // Advance past the first polling interval
    await vi.advanceTimersByTimeAsync(11_000)
    const result = await promise

    const [createUrl, createInit] = calls[0]
    expect(createUrl).toBe('https://api-singapore.klingai.com/v1/videos/image2video')
    expect((createInit.headers as Record<string, string>)['Authorization']).toBe('Bearer mock.kling.jwt')
    expect(result.videoUrl).toBe('https://klingai.com/v.mp4')
  })

  it('rounds a fractional duration to the nearest integer second', async () => {
    let sentBody: { duration?: string } = {}
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init: RequestInit) => {
      if (init?.method === 'POST') {
        sentBody = JSON.parse(init.body as string)
        return { ok: true, json: async () => ({ data: { task_id: 'task-4' } }) }
      }
      return { ok: true, json: async () => ({ data: { task_status: 'succeed', task_result: { videos: [{ url: 'https://klingai.com/v.mp4' }] } } }) }
    }))

    const { KlingVideoProvider } = await import('../../../server/worker/providers/video/kling')
    const promise = new KlingVideoProvider().generate({
      job: {} as never, apiKey: JSON.stringify(CREDS), model: 'm', prompt: 'p', duration: 5.9,
    })
    await vi.advanceTimersByTimeAsync(11_000)
    await promise
    expect(sentBody.duration).toBe('6')
  })

  it('resolves with videoUrl from task_result', async () => {
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init: RequestInit) => {
      if (init?.method === 'POST') {
        return { ok: true, json: async () => ({ data: { task_id: 'task-2' } }) }
      }
      return { ok: true, json: async () => ({ data: { task_status: 'succeed', task_result: { videos: [{ url: 'https://klingai.com/out.mp4' }] } } }) }
    }))

    const { KlingVideoProvider } = await import('../../../server/worker/providers/video/kling')
    const promise = new KlingVideoProvider().generate({
      job: {} as never, apiKey: JSON.stringify(CREDS), model: 'm', prompt: 'p',
    })
    await vi.advanceTimersByTimeAsync(11_000)
    const result = await promise
    expect(result.videoUrl).toBe('https://klingai.com/out.mp4')
  })

  it('throws when task_status is "failed"', async () => {
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init: RequestInit) => {
      if (init?.method === 'POST') {
        return { ok: true, json: async () => ({ data: { task_id: 'task-3' } }) }
      }
      return { ok: true, json: async () => ({ data: { task_status: 'failed', task_status_msg: 'quota exceeded' } }) }
    }))

    const { KlingVideoProvider } = await import('../../../server/worker/providers/video/kling')
    // Attach assertion before advancing timers to avoid unhandled rejection warning
    const assertion = expect(
      new KlingVideoProvider().generate({ job: {} as never, apiKey: JSON.stringify(CREDS), model: 'm', prompt: 'p' })
    ).rejects.toThrow('quota exceeded')
    await vi.advanceTimersByTimeAsync(11_000)
    await assertion
  })
})
