// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('IdeogramImageProvider', () => {
  beforeEach(() => vi.clearAllMocks())

  it('sends Api-Key header', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [{ url: 'https://ideogram.ai/img.png' }] }),
    })
    vi.stubGlobal('fetch', mockFetch)
    const { IdeogramImageProvider } = await import('../../../server/worker/providers/image/ideogram')
    await new IdeogramImageProvider().generate({ job: {} as never, apiKey: 'ideogram-key', model: 'V_3', prompt: 'Cat' })
    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect((init.headers as Record<string, string>)['Api-Key']).toBe('ideogram-key')
    vi.unstubAllGlobals()
  })

  it('returns imageUrl from data[0].url', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [{ url: 'https://ideogram.ai/result.png' }] }),
    }))
    const { IdeogramImageProvider } = await import('../../../server/worker/providers/image/ideogram')
    const result = await new IdeogramImageProvider().generate({ job: {} as never, apiKey: 'k', model: 'V_3', prompt: 'p' })
    expect(result.imageUrl).toBe('https://ideogram.ai/result.png')
    vi.unstubAllGlobals()
  })

  it('throws on non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false, status: 401,
      text: () => Promise.resolve('unauthorized'),
    }))
    const { IdeogramImageProvider } = await import('../../../server/worker/providers/image/ideogram')
    await expect(
      new IdeogramImageProvider().generate({ job: {} as never, apiKey: 'k', model: 'V_3', prompt: 'p' })
    ).rejects.toThrow('Ideogram error 401')
    vi.unstubAllGlobals()
  })
})
