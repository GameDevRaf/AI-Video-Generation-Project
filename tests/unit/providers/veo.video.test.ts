// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

const OPERATION_NAME = 'operations/abc123'

function makeCreateResponse() {
  return { ok: true, json: async () => ({ name: OPERATION_NAME }) }
}
function makePollPending() {
  return { ok: true, json: async () => ({ done: false }) }
}
function makePollDone(videoUri = 'https://generativelanguage.googleapis.com/v1beta/files/vid1') {
  return {
    ok: true,
    json: async () => ({
      done: true,
      response: {
        generateVideoResponse: {
          generatedSamples: [{ video: { uri: videoUri } }],
        },
      },
    }),
  }
}
function makePollError(msg: string) {
  return { ok: true, json: async () => ({ done: true, error: { message: msg } }) }
}

const FAKE_VIDEO = Buffer.from('fake-mp4')
function makeVideoDownload(buffer = FAKE_VIDEO) {
  return {
    ok: true,
    headers: { get: (h: string) => h === 'content-type' ? 'video/mp4' : null },
    arrayBuffer: async () => buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
  }
}

describe('VeoVideoProvider', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.useFakeTimers()
  })
  afterEach(() => vi.useRealTimers())

  it('POSTs to predictLongRunning endpoint with x-goog-api-key (fake timers)', async () => {
    mockFetch
      .mockResolvedValueOnce(makeCreateResponse())
      .mockResolvedValueOnce(makePollDone())
      .mockResolvedValueOnce(makeVideoDownload())

    const { VeoVideoProvider } = await import('../../../server/worker/providers/video/veo')
    const promise = new VeoVideoProvider().generate({
      job: {} as never, apiKey: 'goog-key', model: 'veo-3.1-generate-preview',
      prompt: 'A cat video', duration: 5,    })

    await vi.advanceTimersByTimeAsync(10_500)
    await promise

    const [url, opts] = mockFetch.mock.calls[0]
    expect(url).toContain('veo-3.1-generate-preview:predictLongRunning')
    expect(opts.headers['x-goog-api-key']).toBe('goog-key')
  })

  it('polls until done and returns rawBuffer (fake timers)', async () => {
    mockFetch
      .mockResolvedValueOnce(makeCreateResponse())
      .mockResolvedValueOnce(makePollPending())
      .mockResolvedValueOnce(makePollDone())
      .mockResolvedValueOnce(makeVideoDownload())

    const { VeoVideoProvider } = await import('../../../server/worker/providers/video/veo')
    const promise = new VeoVideoProvider().generate({
      job: {} as never, apiKey: 'k', model: 'veo-3.1-generate-preview',
      prompt: 'A sunset', duration: 5,    })

    // Two poll intervals (pending + done)
    await vi.advanceTimersByTimeAsync(10_500)
    await vi.advanceTimersByTimeAsync(10_500)
    const result = await promise

    expect(result.rawBuffer).toBeDefined()
    expect(result.mimeType).toBe('video/mp4')
  })

  it('rounds a fractional duration to the nearest integer second', async () => {
    mockFetch
      .mockResolvedValueOnce(makeCreateResponse())
      .mockResolvedValueOnce(makePollDone())
      .mockResolvedValueOnce(makeVideoDownload())

    const { VeoVideoProvider } = await import('../../../server/worker/providers/video/veo')
    const promise = new VeoVideoProvider().generate({
      job: {} as never, apiKey: 'goog-key', model: 'veo-3.1-generate-preview',
      prompt: 'A cat video', duration: 6.5,    })

    await vi.advanceTimersByTimeAsync(10_500)
    await promise

    const [, opts] = mockFetch.mock.calls[0]
    const body = JSON.parse(opts.body)
    expect(body.parameters.durationSeconds).toBe(7)
  })

  it('throws when create returns no operation name', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) })
    const { VeoVideoProvider } = await import('../../../server/worker/providers/video/veo')
    await expect(
      new VeoVideoProvider().generate({
        job: {} as never, apiKey: 'k', model: 'm', prompt: 'p', duration: 5,      })
    ).rejects.toThrow('operation name')
  })

  it('throws when poll returns error (fake timers)', async () => {
    mockFetch
      .mockResolvedValueOnce(makeCreateResponse())
      .mockResolvedValueOnce(makePollError('Rate limited'))

    const { VeoVideoProvider } = await import('../../../server/worker/providers/video/veo')
    const assertion = expect(
      new VeoVideoProvider().generate({
        job: {} as never, apiKey: 'k', model: 'm', prompt: 'p', duration: 5,      })
    ).rejects.toThrow('Rate limited')

    await vi.advanceTimersByTimeAsync(10_500)
    await assertion
  })
})
