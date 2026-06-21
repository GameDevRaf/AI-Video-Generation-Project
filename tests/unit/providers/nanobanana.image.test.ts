// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

function makeGeminiImageResponse(base64Data: string, mimeType = 'image/png') {
  return {
    ok: true,
    json: async () => ({
      candidates: [{
        content: {
          parts: [{ inlineData: { mimeType, data: base64Data } }],
        },
      }],
    }),
  }
}

describe('NanaBananaImageProvider', () => {
  beforeEach(() => vi.clearAllMocks())

  it('calls Gemini API with x-goog-api-key', async () => {
    const imgBase64 = Buffer.from('fake-image').toString('base64')
    mockFetch.mockResolvedValueOnce(makeGeminiImageResponse(imgBase64))
    const { NanaBananaImageProvider } = await import('../../../server/worker/providers/image/nanobanana')
    await new NanaBananaImageProvider().generate({
      job: {} as never, apiKey: 'goog-key', model: 'gemini-3.1-flash-image', prompt: 'A cat',
    })
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('gemini-3.1-flash-image:generateContent'),
      expect.objectContaining({
        headers: expect.objectContaining({ 'x-goog-api-key': 'goog-key' }),
      }),
    )
  })

  it('returns rawBuffer decoded from base64', async () => {
    const imgBase64 = Buffer.from('image-bytes').toString('base64')
    mockFetch.mockResolvedValueOnce(makeGeminiImageResponse(imgBase64))
    const { NanaBananaImageProvider } = await import('../../../server/worker/providers/image/nanobanana')
    const result = await new NanaBananaImageProvider().generate({
      job: {} as never, apiKey: 'k', model: 'gemini-3.1-flash-image', prompt: 'A dog',
    })
    expect(result.rawBuffer).toEqual(Buffer.from('image-bytes'))
    expect(result.mimeType).toBe('image/png')
  })

  it('throws when no image part in response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ text: 'no image' }] } }] }),
    })
    const { NanaBananaImageProvider } = await import('../../../server/worker/providers/image/nanobanana')
    await expect(
      new NanaBananaImageProvider().generate({ job: {} as never, apiKey: 'k', model: 'm', prompt: 'p' })
    ).rejects.toThrow('no image data')
  })

  it('throws on API error', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 400, text: async () => 'Bad request' })
    const { NanaBananaImageProvider } = await import('../../../server/worker/providers/image/nanobanana')
    await expect(
      new NanaBananaImageProvider().generate({ job: {} as never, apiKey: 'k', model: 'm', prompt: 'p' })
    ).rejects.toThrow('400')
  })
})
