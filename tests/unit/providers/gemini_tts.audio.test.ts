// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

// Minimal valid PCM data (44 bytes so WAV header math stays sane)
const FAKE_PCM = Buffer.alloc(100, 0x20)

function makeGeminiTTSResponse(pcmBuffer = FAKE_PCM) {
  return {
    ok: true,
    json: async () => ({
      candidates: [{
        content: {
          parts: [{ inlineData: { mimeType: 'audio/pcm;rate=24000', data: pcmBuffer.toString('base64') } }],
        },
      }],
    }),
  }
}

describe('GeminiTTSProvider', () => {
  beforeEach(() => vi.clearAllMocks())

  it('calls Gemini API with x-goog-api-key', async () => {
    mockFetch.mockResolvedValueOnce(makeGeminiTTSResponse())
    const { GeminiTTSProvider } = await import('../../../server/worker/providers/audio/gemini_tts')
    await new GeminiTTSProvider().generate({
      job: {} as never, apiKey: 'goog-key', model: 'gemini-2.5-flash-tts', text: 'Hello', voiceId: 'Kore',
    })
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('gemini-2.5-flash-tts:generateContent'),
      expect.objectContaining({
        headers: expect.objectContaining({ 'x-goog-api-key': 'goog-key' }),
      }),
    )
  })

  it('uses voiceId as prebuiltVoiceConfig voiceName', async () => {
    mockFetch.mockResolvedValueOnce(makeGeminiTTSResponse())
    const { GeminiTTSProvider } = await import('../../../server/worker/providers/audio/gemini_tts')
    await new GeminiTTSProvider().generate({
      job: {} as never, apiKey: 'k', model: 'gemini-2.5-flash-tts', text: 'Hi', voiceId: 'Charon',
    })
    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.generationConfig.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName).toBe('Charon')
  })

  it('returns WAV buffer with RIFF header', async () => {
    mockFetch.mockResolvedValueOnce(makeGeminiTTSResponse())
    const { GeminiTTSProvider } = await import('../../../server/worker/providers/audio/gemini_tts')
    const result = await new GeminiTTSProvider().generate({
      job: {} as never, apiKey: 'k', model: 'm', text: 'Test', voiceId: 'Kore',
    })
    const wav = result.audioBuffer!
    expect(wav.slice(0, 4).toString()).toBe('RIFF')
    expect(wav.slice(8, 12).toString()).toBe('WAVE')
    expect(result.mimeType).toBe('audio/wav')
  })

  it('throws when no audio data in response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ text: 'oops' }] } }] }),
    })
    const { GeminiTTSProvider } = await import('../../../server/worker/providers/audio/gemini_tts')
    await expect(
      new GeminiTTSProvider().generate({ job: {} as never, apiKey: 'k', model: 'm', text: 'Hi', voiceId: '' })
    ).rejects.toThrow('no audio data')
  })
})
