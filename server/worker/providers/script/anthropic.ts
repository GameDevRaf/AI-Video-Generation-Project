import Anthropic from '@anthropic-ai/sdk'
import type { ScriptProvider, ScriptParams, ScriptResult, ScriptImage } from '../types'

/** Attach images (if any) to the last user message as Anthropic content blocks. */
function buildMessages(
  messages: ScriptParams['messages'],
  images?: ScriptImage[],
): Anthropic.MessageParam[] {
  if (!images?.length) {
    return messages.map(m => ({ role: m.role, content: m.content }))
  }

  const lastUserIdx = messages.map(m => m.role).lastIndexOf('user')
  return messages.map((m, i): Anthropic.MessageParam => {
    if (i !== lastUserIdx) return { role: m.role, content: m.content }
    return {
      role: 'user',
      content: [
        ...images.map(img => ({
          type: 'image' as const,
          source: {
            type: 'base64' as const,
            media_type: img.mimeType as 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp',
            data: img.base64,
          },
        })),
        { type: 'text' as const, text: m.content },
      ],
    }
  })
}

export class AnthropicScriptProvider implements ScriptProvider {
  readonly providerId = 'anthropic'

  async generate(params: ScriptParams): Promise<ScriptResult> {
    const client = new Anthropic({ apiKey: params.apiKey })

    const message = await client.messages.create({
      model: params.model,
      max_tokens: params.maxTokens ?? 4096,
      system: params.systemPrompt,
      messages: buildMessages(params.messages, params.images),
    })

    const text = message.content
      .filter(b => b.type === 'text')
      .map(b => (b as { type: 'text'; text: string }).text)
      .join('')

    return { text }
  }
}
