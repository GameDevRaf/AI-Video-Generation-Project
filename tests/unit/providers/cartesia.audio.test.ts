// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('CartesiaAudioProvider', () => {
  beforeEach(() => vi.clearAllMocks())

  it('sends Cartesia-Version header', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
    })
    vi.stubGlobal('fetch', mockFetch)
    const { CartesiaAudioProvider } = await import('../../../server/worker/providers/audio/cartesia')
    await new CartesiaAudioProvider().generate({
      job: {} as never, apiKey: 'cart-key', model: 'sonic-2', text: 'Hello', voiceId: 'voice-id-1',
    })
    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect((init.headers as Record<string, string>)['Cartesia-Version']).toBe('2025-04-16')
    vi.unstubAllGlobals()
  })

  it('sends voice id in request body', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
    }))
    const { CartesiaAudioProvider } = await import('../../../server/worker/providers/audio/cartesia')
    await new CartesiaAudioProvider().generate({
      job: {} as never, apiKey: 'k', model: 'sonic-2', text: 'Hi', voiceId: 'v-123',
    })
    const body = JSON.parse((global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body as string)
    expect(body.voice.id).toBe('v-123')
    vi.unstubAllGlobals()
  })

  it('returns audioBuffer and audio/wav mimeType', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(Buffer.from('RIFF').buffer),
    }))
    const { CartesiaAudioProvider } = await import('../../../server/worker/providers/audio/cartesia')
    const result = await new CartesiaAudioProvider().generate({
      job: {} as never, apiKey: 'k', model: 'sonic-2', text: 'Hi', voiceId: 'v',
    })
    expect(result.audioBuffer).toBeInstanceOf(Buffer)
    expect(result.mimeType).toBe('audio/wav')
    vi.unstubAllGlobals()
  })
})
