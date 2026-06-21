// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSpeechCreate = vi.fn()
vi.mock('openai', () => ({
  default: class {
    audio = { speech: { create: mockSpeechCreate } }
    images = { generate: vi.fn() }
    chat = { completions: { create: vi.fn() } }
  },
}))

describe('OpenAITTSProvider', () => {
  beforeEach(() => vi.clearAllMocks())

  it('calls audio.speech.create with model and voice', async () => {
    mockSpeechCreate.mockResolvedValueOnce({ arrayBuffer: () => Promise.resolve(new ArrayBuffer(4)) })
    const { OpenAITTSProvider } = await import('../../../server/worker/providers/audio/openai_tts')
    await new OpenAITTSProvider().generate({
      job: {} as never, apiKey: 'oai-key', model: 'tts-1-hd', text: 'Read this', voiceId: 'nova',
    })
    expect(mockSpeechCreate).toHaveBeenCalledWith(expect.objectContaining({
      model: 'tts-1-hd',
      voice: 'nova',
      input: 'Read this',
    }))
  })

  it('falls back to "onyx" voice for unknown voiceId', async () => {
    mockSpeechCreate.mockResolvedValueOnce({ arrayBuffer: () => Promise.resolve(new ArrayBuffer(4)) })
    const { OpenAITTSProvider } = await import('../../../server/worker/providers/audio/openai_tts')
    await new OpenAITTSProvider().generate({
      job: {} as never, apiKey: 'k', model: 'tts-1', text: 't', voiceId: 'not-a-valid-voice',
    })
    expect(mockSpeechCreate).toHaveBeenCalledWith(expect.objectContaining({ voice: 'onyx' }))
  })

  it('returns a Buffer and audio/mpeg mimeType', async () => {
    mockSpeechCreate.mockResolvedValueOnce({ arrayBuffer: () => Promise.resolve(new ArrayBuffer(4)) })
    const { OpenAITTSProvider } = await import('../../../server/worker/providers/audio/openai_tts')
    const result = await new OpenAITTSProvider().generate({
      job: {} as never, apiKey: 'k', model: 'tts-1', text: 't', voiceId: 'alloy',
    })
    expect(result.audioBuffer).toBeInstanceOf(Buffer)
    expect(result.mimeType).toBe('audio/mpeg')
  })
})
