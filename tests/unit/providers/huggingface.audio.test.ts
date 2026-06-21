// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

function makeAudioResponse(bytes = Buffer.from('wav'), mime = 'audio/wav') {
  return {
    ok: true,
    status: 200,
    headers: { get: (h: string) => h === 'content-type' ? mime : null },
    arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  }
}

describe('HuggingFaceAudioProvider', () => {
  beforeEach(() => vi.clearAllMocks())

  it('calls HF inference API with Bearer token', async () => {
    mockFetch.mockResolvedValueOnce(makeAudioResponse())
    const { HuggingFaceAudioProvider } = await import('../../../server/worker/providers/audio/huggingface_audio')
    await new HuggingFaceAudioProvider().generate({
      job: {} as never, apiKey: 'hf-tok', model: 'facebook/mms-tts-eng', text: 'Hello', voiceId: '',
    })
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api-inference.huggingface.co/models/facebook/mms-tts-eng',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer hf-tok' }),
      }),
    )
  })

  it('sends text as inputs field', async () => {
    mockFetch.mockResolvedValueOnce(makeAudioResponse())
    const { HuggingFaceAudioProvider } = await import('../../../server/worker/providers/audio/huggingface_audio')
    await new HuggingFaceAudioProvider().generate({
      job: {} as never, apiKey: 'k', model: 'm', text: 'The quick brown fox', voiceId: '',
    })
    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.inputs).toBe('The quick brown fox')
  })

  it('returns audioBuffer from response bytes', async () => {
    const wav = Buffer.from('fake-wav-data')
    mockFetch.mockResolvedValueOnce(makeAudioResponse(wav))
    const { HuggingFaceAudioProvider } = await import('../../../server/worker/providers/audio/huggingface_audio')
    const result = await new HuggingFaceAudioProvider().generate({
      job: {} as never, apiKey: 'k', model: 'm', text: 'Hi', voiceId: '',
    })
    expect(Buffer.from(result.audioBuffer!)).toEqual(wav)
    expect(result.mimeType).toBe('audio/wav')
  })

  it('retries on 503 (model loading)', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({ estimated_time: 0.001 }) })
      .mockResolvedValueOnce(makeAudioResponse())
    const { HuggingFaceAudioProvider } = await import('../../../server/worker/providers/audio/huggingface_audio')
    await new HuggingFaceAudioProvider().generate({
      job: {} as never, apiKey: 'k', model: 'm', text: 'hi', voiceId: '',
    })
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })
})
