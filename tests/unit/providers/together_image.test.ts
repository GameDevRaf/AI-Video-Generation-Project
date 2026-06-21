// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockCreate = vi.fn()
vi.mock('together-ai', () => ({
  default: class {
    images = { create: mockCreate }
  },
}))

describe('TogetherImageProvider', () => {
  beforeEach(() => vi.clearAllMocks())

  it('calls images.create with model and prompt', async () => {
    mockCreate.mockResolvedValueOnce({ data: [{ url: 'https://together.ai/img.png' }] })
    const { TogetherImageProvider } = await import('../../../server/worker/providers/image/together_image')
    await new TogetherImageProvider().generate({ job: {} as never, apiKey: 'tog-key', model: 'black-forest-labs/FLUX.2-dev', prompt: 'Forest' })
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
      model: 'black-forest-labs/FLUX.2-dev',
      prompt: 'Forest',
    }))
  })

  it('returns imageUrl from data[0].url', async () => {
    mockCreate.mockResolvedValueOnce({ data: [{ url: 'https://together.ai/out.png' }] })
    const { TogetherImageProvider } = await import('../../../server/worker/providers/image/together_image')
    const result = await new TogetherImageProvider().generate({ job: {} as never, apiKey: 'k', model: 'm', prompt: 'p' })
    expect(result.imageUrl).toBe('https://together.ai/out.png')
  })

  it('throws when data array is empty', async () => {
    mockCreate.mockResolvedValueOnce({ data: [] })
    const { TogetherImageProvider } = await import('../../../server/worker/providers/image/together_image')
    await expect(
      new TogetherImageProvider().generate({ job: {} as never, apiKey: 'k', model: 'm', prompt: 'p' })
    ).rejects.toThrow('Together AI returned no image URL')
  })
})
