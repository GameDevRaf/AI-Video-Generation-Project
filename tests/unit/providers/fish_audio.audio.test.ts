// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

function makeAudioResponse(bytes = Buffer.from('mp3data')) {
  return {
    ok: true,
    headers: { get: (h: string) => h === 'content-type' ? 'audio/mpeg' : null },
    arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  }
}

describe('FishAudioProvider', () => {
  beforeEach(() => vi.clearAllMocks())

  it('sends model in HTTP header, not body', async () => {
    mockFetch.mockResolvedValueOnce(makeAudioResponse())
    const { FishAudioProvider } = await import('../../../server/worker/providers/audio/fish_audio')
    await new FishAudioProvider().generate({
      job: {} as never, apiKey: 'fish-key', model: 's2-pro', text: 'Hello world', voiceId: '',
    })
    const [, options] = mockFetch.mock.calls[0]
    expect(options.headers['model']).toBe('s2-pro')
    const body = JSON.parse(options.body)
    expect(body).not.toHaveProperty('model')
  })

  it('includes reference_id when voiceId provided', async () => {
    mockFetch.mockResolvedValueOnce(makeAudioResponse())
    const { FishAudioProvider } = await import('../../../server/worker/providers/audio/fish_audio')
    await new FishAudioProvider().generate({
      job: {} as never, apiKey: 'k', model: 's1', text: 'Test', voiceId: 'voice-abc123',
    })
    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.reference_id).toBe('voice-abc123')
  })

  it('omits reference_id when voiceId is empty', async () => {
    mockFetch.mockResolvedValueOnce(makeAudioResponse())
    const { FishAudioProvider } = await import('../../../server/worker/providers/audio/fish_audio')
    await new FishAudioProvider().generate({
      job: {} as never, apiKey: 'k', model: 's1', text: 'Test', voiceId: '',
    })
    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body).not.toHaveProperty('reference_id')
  })

  it('returns audioBuffer with audio/mpeg mimeType', async () => {
    const mp3 = Buffer.from('fake-mp3')
    mockFetch.mockResolvedValueOnce(makeAudioResponse(mp3))
    const { FishAudioProvider } = await import('../../../server/worker/providers/audio/fish_audio')
    const result = await new FishAudioProvider().generate({
      job: {} as never, apiKey: 'k', model: 's2-pro', text: 'Hello', voiceId: '',
    })
    expect(Buffer.from(result.audioBuffer!)).toEqual(mp3)
    expect(result.mimeType).toBe('audio/mpeg')
  })

  it('throws on API error', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 403, text: async () => 'Forbidden' })
    const { FishAudioProvider } = await import('../../../server/worker/providers/audio/fish_audio')
    await expect(
      new FishAudioProvider().generate({ job: {} as never, apiKey: 'bad', model: 's2-pro', text: 'Hi', voiceId: '' })
    ).rejects.toThrow('403')
  })
})
