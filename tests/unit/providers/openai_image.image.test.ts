// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGenerate = vi.fn()
vi.mock('openai', () => ({
  default: class {
    images = { generate: mockGenerate }
  },
}))

describe('OpenAIImageProvider', () => {
  beforeEach(() => vi.clearAllMocks())

  it('does not send response_format (unsupported for GPT image models)', async () => {
    mockGenerate.mockResolvedValueOnce({ data: [{ b64_json: Buffer.from('img').toString('base64') }] })
    const { OpenAIImageProvider } = await import('../../../server/worker/providers/image/openai_image')
    await new OpenAIImageProvider().generate({ job: {} as never, apiKey: 'oai-key', model: 'gpt-image-2', prompt: 'A cat' })
    const call = mockGenerate.mock.calls[0][0]
    expect(call).not.toHaveProperty('response_format')
    expect(call.model).toBe('gpt-image-2')
    expect(call.prompt).toBe('A cat')
  })

  it('decodes b64_json into rawBuffer with image/png mimeType', async () => {
    const imgBytes = Buffer.from('raw-image-bytes')
    mockGenerate.mockResolvedValueOnce({ data: [{ b64_json: imgBytes.toString('base64') }] })
    const { OpenAIImageProvider } = await import('../../../server/worker/providers/image/openai_image')
    const result = await new OpenAIImageProvider().generate({ job: {} as never, apiKey: 'k', model: 'gpt-image-2', prompt: 'p' })
    expect(result.rawBuffer).toEqual(imgBytes)
    expect(result.mimeType).toBe('image/png')
    expect(result.imageUrl).toBeUndefined()
  })

  it('throws when no b64_json in response', async () => {
    mockGenerate.mockResolvedValueOnce({ data: [{}] })
    const { OpenAIImageProvider } = await import('../../../server/worker/providers/image/openai_image')
    await expect(
      new OpenAIImageProvider().generate({ job: {} as never, apiKey: 'k', model: 'gpt-image-2', prompt: 'p' })
    ).rejects.toThrow('OpenAI Images returned no image data')
  })
})
