// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

function makeVideoResponse(bytes = Buffer.from('vid'), mime = 'video/mp4') {
  return {
    ok: true,
    status: 200,
    headers: { get: (h: string) => h === 'content-type' ? mime : null },
    arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  }
}

describe('HuggingFaceVideoProvider', () => {
  beforeEach(() => vi.clearAllMocks())

  it('calls HF inference API with Bearer token and prompt', async () => {
    mockFetch.mockResolvedValueOnce(makeVideoResponse())
    const { HuggingFaceVideoProvider } = await import('../../../server/worker/providers/video/huggingface_video')
    await new HuggingFaceVideoProvider().generate({
      job: {} as never, apiKey: 'hf-tok', model: 'Wan-AI/Wan2.1-T2V-14B',
      prompt: 'A flying bird', duration: 4, aspectRatio: '16:9',
    })
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api-inference.huggingface.co/models/Wan-AI/Wan2.1-T2V-14B',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer hf-tok' }),
      }),
    )
    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.inputs).toBe('A flying bird')
  })

  it('returns rawBuffer from response bytes', async () => {
    const vidBytes = Buffer.from('fake-video')
    mockFetch.mockResolvedValueOnce(makeVideoResponse(vidBytes))
    const { HuggingFaceVideoProvider } = await import('../../../server/worker/providers/video/huggingface_video')
    const result = await new HuggingFaceVideoProvider().generate({
      job: {} as never, apiKey: 'k', model: 'm', prompt: 'p', duration: 5, aspectRatio: '16:9',
    })
    expect(Buffer.from(result.rawBuffer!)).toEqual(vidBytes)
    expect(result.mimeType).toBe('video/mp4')
  })

  it('retries on 503 (model loading)', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({ estimated_time: 0.001 }) })
      .mockResolvedValueOnce(makeVideoResponse())
    const { HuggingFaceVideoProvider } = await import('../../../server/worker/providers/video/huggingface_video')
    await new HuggingFaceVideoProvider().generate({
      job: {} as never, apiKey: 'k', model: 'm', prompt: 'p', duration: 5, aspectRatio: '16:9',
    })
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it('throws on HTTP error', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500, text: async () => 'Server error' })
    const { HuggingFaceVideoProvider } = await import('../../../server/worker/providers/video/huggingface_video')
    await expect(
      new HuggingFaceVideoProvider().generate({
        job: {} as never, apiKey: 'k', model: 'm', prompt: 'p', duration: 5, aspectRatio: '16:9',
      })
    ).rejects.toThrow('500')
  })
})
