import type { AudioProvider, AudioParams, AudioResult } from '../types'

// Google Gemini TTS via Gemini API (Google AI Studio key)
// Endpoint: POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent
// Response: base64-encoded raw PCM (24kHz, mono, 16-bit LE) — converted to WAV here.
// Docs: https://ai.google.dev/gemini-api/docs/speech-generation
const GEMINI_TTS_BASE = 'https://generativelanguage.googleapis.com/v1beta'

function pcmToWav(pcm: Buffer, sampleRate = 24000, channels = 1, bitsPerSample = 16): Buffer {
  const dataSize = pcm.length
  const header = Buffer.alloc(44)
  header.write('RIFF', 0)
  header.writeUInt32LE(36 + dataSize, 4)
  header.write('WAVE', 8)
  header.write('fmt ', 12)
  header.writeUInt32LE(16, 16)
  header.writeUInt16LE(1, 20)  // PCM
  header.writeUInt16LE(channels, 22)
  header.writeUInt32LE(sampleRate, 24)
  header.writeUInt32LE(sampleRate * channels * (bitsPerSample / 8), 28)
  header.writeUInt16LE(channels * (bitsPerSample / 8), 32)
  header.writeUInt16LE(bitsPerSample, 34)
  header.write('data', 36)
  header.writeUInt32LE(dataSize, 40)
  return Buffer.concat([header, pcm])
}

export class GeminiTTSProvider implements AudioProvider {
  readonly providerId = 'gemini_tts'

  async generate(params: AudioParams): Promise<AudioResult> {
    const url = `${GEMINI_TTS_BASE}/models/${params.model}:generateContent`

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'x-goog-api-key': params.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: params.text }] }],
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: params.voiceId || 'Kore',
              },
            },
          },
        },
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Gemini TTS error ${res.status}: ${err}`)
    }

    const json = await res.json() as {
      candidates?: Array<{
        content?: {
          parts?: Array<{
            inlineData?: { mimeType: string; data: string }
          }>
        }
      }>
    }

    const part = json.candidates?.[0]?.content?.parts?.[0]
    if (!part?.inlineData?.data) {
      throw new Error('Gemini TTS returned no audio data')
    }

    const pcm = Buffer.from(part.inlineData.data, 'base64')
    const audioBuffer = pcmToWav(pcm)
    return { audioBuffer, mimeType: 'audio/wav' }
  }
}
