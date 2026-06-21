import { GoogleGenAI } from '@google/genai'
import type { ScriptProvider, ScriptParams, ScriptResult } from '../types'

export class GeminiScriptProvider implements ScriptProvider {
  readonly providerId = 'gemini'

  async generate(params: ScriptParams): Promise<ScriptResult> {
    const ai = new GoogleGenAI({ apiKey: params.apiKey })

    const contents = params.messages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }))

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
