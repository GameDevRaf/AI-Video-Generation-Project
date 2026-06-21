// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const CREDS = { apiKey: 'pht-key', userId: 'user-xyz' }

describe('PlayHTAudioProvider', () => {
  beforeEach(() => vi.clearAllMocks())

  it('sends X-User-Id header from parsed credentials', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
    })
    vi.stubGlobal('fetch', mockFetch)
    const { PlayHTAudioProvider } = await import('../../../server/worker/providers/audio/playht')
    await new PlayHTAudioProvider().generate({
      job: {} as never,
      apiKey: JSON.stringify(CREDS),
      model: 'PlayDialog',
      text: 'Hello',
      voiceId: 'some-voice',
    })
    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect((init.headers as Record<string, string>)['X-User-Id']).toBe('user-xyz')
    vi.unstubAllGlobals()
  })

  it('sends Authorization: Bearer with apiKey from credentials', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
    }))
    const { PlayHTAudioProvider } = await import('../../../server/worker/providers/audio/playht')
    await new PlayHTAudioProvider().generate({
      job: {} as never,
      apiKey: JSON.stringify(CREDS),
      model: 'PlayDialog',
      text: 'Hi',
      voiceId: 'v',
    })
    const [, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit]
    expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer pht-key')
    vi.unstubAllGlobals()
  })

  it('throws when credentials are not valid JSON', async () => {
    vi.stubGlobal('fetch', vi.fn())
    const { PlayHTAudioProvider } = await import('../../../server/worker/providers/audio/playht')
    await expect(
      new PlayHTAudioProvider().generate({
        job: {} as never, apiKey: 'not-json', model: 'm', text: 't', voiceId: 'v',
      })
    ).rejects.toThrow('PlayHT credentials must be stored as JSON')
    vi.unstubAllGlobals()
  })
})
