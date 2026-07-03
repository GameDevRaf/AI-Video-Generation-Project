// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockCreate = vi.fn()
vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = { create: mockCreate }
  },
}))

const textResponse = { content: [{ type: 'text', text: 'Generated text' }] }

describe('AnthropicScriptProvider', () => {
  beforeEach(() => vi.clearAllMocks())

  it('sends system prompt and plain-string messages when no images', async () => {
    mockCreate.mockResolvedValueOnce(textResponse)
    const { AnthropicScriptProvider } = await import('../../../server/worker/providers/script/anthropic')
    await new AnthropicScriptProvider().generate({
      job: {} as never, apiKey: 'k', model: 'claude-sonnet-4-6',
      systemPrompt: 'You are a director',
      messages: [{ role: 'user', content: 'Write the motion prompt' }],
    })
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
      model: 'claude-sonnet-4-6',
      system: 'You are a director',
      messages: [{ role: 'user', content: 'Write the motion prompt' }],
    }))
  })

  it('attaches images to the last user message as base64 image blocks', async () => {
    mockCreate.mockResolvedValueOnce(textResponse)
    const { AnthropicScriptProvider } = await import('../../../server/worker/providers/script/anthropic')
    await new AnthropicScriptProvider().generate({
      job: {} as never, apiKey: 'k', model: 'claude-sonnet-4-6',
      messages: [{ role: 'user', content: 'Animate from the first frame' }],
      images: [{ base64: 'ZZZZ', mimeType: 'image/jpeg' }],
    })
    const sent = mockCreate.mock.calls[0][0].messages
    expect(sent[0]).toEqual({
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: 'ZZZZ' } },
        { type: 'text', text: 'Animate from the first frame' },
      ],
    })
  })

  it('joins text blocks from the response', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'part-1 ' }, { type: 'text', text: 'part-2' }],
    })
    const { AnthropicScriptProvider } = await import('../../../server/worker/providers/script/anthropic')
    const res = await new AnthropicScriptProvider().generate({
      job: {} as never, apiKey: 'k', model: 'claude-sonnet-4-6',
      messages: [{ role: 'user', content: 'hi' }],
    })
    expect(res.text).toBe('part-1 part-2')
  })
})
