// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGenerate = vi.fn()
vi.mock('together-ai', () => ({
  default: class {
    images = { generate: mockGenerate }
  },
}))

describe('TogetherImageProvider', () => {
  beforeEach(() => vi.clearAllMocks())

  it('calls images.generate with model and prompt', async () => {
    mockGenerate.mockResolvedValueOnce({ data: [{ url: 'https://together.ai/img.png' }] })
    const { TogetherImageProvider } = await import('../../../server/worker/providers/image/together_image')
    await new TogetherImageProvider().generate({ job: {} as never, apiKey: 'tog-key', model: 'black-forest-labs/FLUX.2-dev', prompt: 'Forest' })
    expect(mockGenerate).toHaveBeenCalledWith(expect.objectContaining({
      model: 'black-forest-labs/FLUX.2-dev',
      prompt: 'Forest',
    }))
  })

  it('forwards negativePrompt as negative_prompt when provided', async () => {
    mockGenerate.mockResolvedValueOnce({ data: [{ url: 'https://together.ai/img.png' }] })
    const { TogetherImageProvider } = await import('../../../server/worker/providers/image/together_image')
    await new TogetherImageProvider().generate({
      job: {} as never, apiKey: 'k', model: 'm', prompt: 'p', negativePrompt: 'blurry, low quality',
    })
    expect(mockGenerate).toHaveBeenCalledWith(expect.objectContaining({ negative_prompt: 'blurry, low quality' }))
  })

  it('omits negative_prompt when not provided', async () => {
    mockGenerate.mockResolvedValueOnce({ data: [{ url: 'https://together.ai/img.png' }] })
    const { TogetherImageProvider } = await import('../../../server/worker/providers/image/together_image')
    await new TogetherImageProvider().generate({ job: {} as never, apiKey: 'k', model: 'm', prompt: 'p' })
    expect(mockGenerate.mock.calls[0][0]).not.toHaveProperty('negative_prompt')
  })

  it('returns imageUrl from data[0].url', async () => {
    mockGenerate.mockResolvedValueOnce({ data: [{ url: 'https://together.ai/out.png' }] })
    const { TogetherImageProvider } = await import('../../../server/worker/providers/image/together_image')
    const result = await new TogetherImageProvider().generate({ job: {} as never, apiKey: 'k', model: 'm', prompt: 'p' })
    expect(result.imageUrl).toBe('https://together.ai/out.png')
  })

  it('throws when data array is empty', async () => {
    mockGenerate.mockResolvedValueOnce({ data: [] })
    const { TogetherImageProvider } = await import('../../../server/worker/providers/image/together_image')
    await expect(
      new TogetherImageProvider().generate({ job: {} as never, apiKey: 'k', model: 'm', prompt: 'p' })
    ).rejects.toThrow('Together AI returned no image URL')
  })
})
