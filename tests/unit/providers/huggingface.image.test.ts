// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

function makeImageResponse(bytes = Buffer.from('img'), mime = 'image/png') {
  return {
    ok: true,
    status: 200,
    headers: { get: (h: string) => h === 'content-type' ? mime : null },
    arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  }
}

describe('HuggingFaceImageProvider', () => {
  beforeEach(() => vi.clearAllMocks())

  it('calls HF inference API with Bearer token', async () => {
    mockFetch.mockResolvedValueOnce(makeImageResponse())
    const { HuggingFaceImageProvider } = await import('../../../server/worker/providers/image/huggingface_image')
    await new HuggingFaceImageProvider().generate({
      job: {} as never, apiKey: 'hf-abc', model: 'black-forest-labs/FLUX.1-schnell', prompt: 'A forest',
    })
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-schnell',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer hf-abc' }),
      }),
    )
  })

  it('returns rawBuffer from response bytes', async () => {
    const imgBytes = Buffer.from('raw-image-data')
    mockFetch.mockResolvedValueOnce(makeImageResponse(imgBytes, 'image/jpeg'))
    const { HuggingFaceImageProvider } = await import('../../../server/worker/providers/image/huggingface_image')
    const result = await new HuggingFaceImageProvider().generate({
      job: {} as never, apiKey: 'k', model: 'ByteDance/Hyper-SD', prompt: 'p',
    })
    expect(Buffer.from(result.rawBuffer!)).toEqual(imgBytes)
    expect(result.mimeType).toBe('image/jpeg')
  })

  it('retries on 503 (model loading)', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({ estimated_time: 0.001 }) })
      .mockResolvedValueOnce(makeImageResponse())
    const { HuggingFaceImageProvider } = await import('../../../server/worker/providers/image/huggingface_image')
    await new HuggingFaceImageProvider().generate({
      job: {} as never, apiKey: 'k', model: 'm', prompt: 'p',
    })
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it('throws on HTTP error', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401, text: async () => 'Unauthorized' })
    const { HuggingFaceImageProvider } = await import('../../../server/worker/providers/image/huggingface_image')
    await expect(
      new HuggingFaceImageProvider().generate({ job: {} as never, apiKey: 'bad', model: 'm', prompt: 'p' })
    ).rejects.toThrow('401')
  })
})
