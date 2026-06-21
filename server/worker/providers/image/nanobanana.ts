import type { ImageProvider, ImageParams, ImageResult } from '../types'

// Nano Banana = Google Gemini native image generation (Gemini 3.1 Flash Image / Gemini 3 Pro Image).
// Uses the same Google AI Studio / Gemini API key as the Gemini script provider.
// API docs: https://ai.google.dev/gemini-api/docs/image-generation
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta'

export class NanaBananaImageProvider implements ImageProvider {
  readonly providerId = 'nanobanana'

  async generate(params: ImageParams): Promise<ImageResult> {
    const url = `${GEMINI_API_BASE}/models/${params.model}:generateContent`

    const body: Record<string, unknown> = {
      contents: [{ parts: [{ text: params.prompt }] }],
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE'],
        responseFormat: {
          image: {
            aspectRatio: params.aspectRatio ?? '16:9',
            imageSize: '2K',
          },
        },
      },
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'x-goog-api-key': params.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Nano Banana (Gemini image) error ${res.status}: ${err}`)
    }

    const json = await res.json() as {
      candidates?: Array<{
        content?: {
          parts?: Array<{
            text?: string
            inlineData?: { mimeType: string; data: string }
          }>
        }
      }>
    }

    const parts = json.candidates?.[0]?.content?.parts ?? []
    const imagePart = parts.find(p => p.inlineData?.data)
    if (!imagePart?.inlineData) {
      throw new Error('Nano Banana returned no image data')
    }

    const rawBuffer = Buffer.from(imagePart.inlineData.data, 'base64')
    return { rawBuffer, mimeType: imagePart.inlineData.mimeType ?? 'image/png' }
  }
}
