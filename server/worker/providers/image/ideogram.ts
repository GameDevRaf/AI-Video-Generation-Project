import type { ImageProvider, ImageParams, ImageResult } from '../types'

export class IdeogramImageProvider implements ImageProvider {
  readonly providerId = 'ideogram'

  async generate(params: ImageParams): Promise<ImageResult> {
    const formData = new FormData()
    formData.append('prompt', params.prompt)
    formData.append('rendering_speed', 'DEFAULT')
    // Ideogram's aspect_ratio uses an uppercase "X" separator — '9X16' is VIDEO_FORMAT's
    // hardcoded 9:16 in that format.
    formData.append('aspect_ratio', '9X16')
    if (params.negativePrompt) formData.append('negative_prompt', params.negativePrompt)

    const res = await fetch('https://api.ideogram.ai/v1/ideogram-v3/generate', {
      method: 'POST',
      headers: { 'Api-Key': params.apiKey },
      body: formData,
    })

    if (!res.ok) {
      const msg = await res.text().catch(() => res.statusText)
      throw new Error(`Ideogram error ${res.status}: ${msg}`)
    }

    const json = await res.json() as { data: Array<{ url: string }> }
    const imageUrl = json.data[0]?.url
    if (!imageUrl) throw new Error('Ideogram returned no image URL')

    return { imageUrl }
  }
}
