import { GoogleGenAI } from '@google/genai'
import type { ScriptProvider, ScriptParams, ScriptResult } from '../types'

export class GeminiScriptProvider implements ScriptProvider {
  readonly providerId = 'gemini'

  async generate(params: ScriptParams): Promise<ScriptResult> {
    const ai = new GoogleGenAI({ apiKey: params.apiKey })

    const lastUserIdx = params.messages.map(m => m.role).lastIndexOf('user')

    const contents = params.messages.map((m, idx) => {
      const parts: Array<Record<string, unknown>> = [{ text: m.content }]
      // Attach images to the final user turn only (vision-capable models).
      if (idx === lastUserIdx && params.images?.length) {
        for (const img of params.images) {
          parts.push({ inlineData: { data: img.base64, mimeType: img.mimeType } })
        }
      }
      return { role: m.role === 'assistant' ? 'model' : 'user', parts }
    })

    const res = await ai.models.generateContent({
      model: params.model,
      contents,
      config: {
        systemInstruction: params.systemPrompt,
        maxOutputTokens: params.maxTokens ?? 4096,
      },
    })

    return { text: res.text ?? '' }
  }
}
