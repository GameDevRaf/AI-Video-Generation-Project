// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

async function* makeStream(chunks: Uint8Array[]) {
  for (const chunk of chunks) yield chunk
}

const mockConvert = vi.fn()
vi.mock('@elevenlabs/elevenlabs-js', () => ({
  ElevenLabsClient: class {
    textToSpeech = { convert: mockConvert }
  },
}))

describe('ElevenLabsAudioProvider', () => {
  beforeEach(() => vi.clearAllMocks())

  it('calls convert with text and voiceId', async () => {
    mockConvert.mockReturnValueOnce(makeStream([new Uint8Array([1, 2, 3])]))
    const { ElevenLabsAudioProvider } = await import('../../../server/worker/providers/audio/elevenlabs')
    await new ElevenLabsAudioProvider().generate({
      job: {} as never, apiKey: 'el-key', model: 'eleven_multilingual_v2',
      text: 'Hello world', voiceId: 'voice-abc',
    })
    expect(mockConvert).toHaveBeenCalledWith('voice-abc', expect.objectContaining({ text: 'Hello world' }))
  })

  it('returns a Buffer and audio/mpeg mimeType', async () => {
    mockConvert.mockReturnValueOnce(makeStream([new Uint8Array([0xff, 0xfb, 0x90])]))
    const { ElevenLabsAudioProvider } = await import('../../../server/worker/providers/audio/elevenlabs')
    const result = await new ElevenLabsAudioProvider().generate({
      job: {} as never, apiKey: 'k', model: 'm', text: 'Hi', voiceId: 'v',
    })
    expect(result.audioBuffer).toBeInstanceOf(Buffer)
    expect(result.mimeType).toBe('audio/mpeg')
  })
})
