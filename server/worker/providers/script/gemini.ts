import { GoogleGenAI } from '@google/genai'
import type { ScriptProvider, ScriptParams, ScriptResult } from '../types'

// Gemini 2.5+ models "think" by default, and thinking tokens are drawn from the
// same maxOutputTokens budget as the visible answer. If the caller's budget is
// small (or an attached image makes the model reason more), thinking eats the
// budget and the answer is truncated mid-sentence. Give thinking its OWN budget
// on top of the caller's requested output so it can never starve the response.
const THINKING_BUDGET = 2048

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

    const outputBudget = params.maxTokens ?? 4096
    const res = await ai.models.generateContent({
      model: params.model,
      contents,
      config: {
        systemInstruction: params.systemPrompt,
        // Reserve room for thinking so it does not consume the caller's output budget.
        maxOutputTokens: outputBudget + THINKING_BUDGET,
        thinkingConfig: { thinkingBudget: THINKING_BUDGET },
      },
    })

    return { text: res.text ?? '' }
  }
}
