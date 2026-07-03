import OpenAI from 'openai'
import type { ScriptProvider, ScriptParams, ScriptResult, ScriptImage } from '../types'

/** Attach images (if any) to the last user message as OpenAI content parts (data URLs). */
function buildMessages(
  messages: ScriptParams['messages'],
  images?: ScriptImage[],
): OpenAI.Chat.ChatCompletionMessageParam[] {
  if (!images?.length) {
    return messages.map(m => ({ role: m.role, content: m.content }))
  }

  const lastUserIdx = messages.map(m => m.role).lastIndexOf('user')
  return messages.map((m, i): OpenAI.Chat.ChatCompletionMessageParam => {
    if (i !== lastUserIdx) return { role: m.role, content: m.content }
    return {
      role: 'user',
      content: [
        { type: 'text', text: m.content },
        ...images.map(img => ({
          type: 'image_url' as const,
          image_url: { url: `data:${img.mimeType};base64,${img.base64}` },
        })),
      ],
    }
  })
}

export class OpenAIScriptProvider implements ScriptProvider {
  readonly providerId = 'openai'

  async generate(params: ScriptParams): Promise<ScriptResult> {
    const client = new OpenAI({ apiKey: params.apiKey })

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = params.systemPrompt
      ? [{ role: 'system', content: params.systemPrompt }, ...buildMessages(params.messages, params.images)]
      : buildMessages(params.messages, params.images)

    const res = await client.chat.completions.create({
      model: params.model,
      max_tokens: params.maxTokens ?? 4096,
      messages,
    })

    return { text: res.choices[0]?.message?.content ?? '' }
  }
}
