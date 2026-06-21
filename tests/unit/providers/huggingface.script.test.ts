// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockCreate = vi.fn()
let capturedOptions: Record<string, unknown> = {}

vi.mock('openai', () => ({
  default: class {
    constructor(opts: Record<string, unknown>) {
      capturedOptions = opts
    }
    chat = { completions: { create: mockCreate } }
  },
}))

describe('HuggingFaceScriptProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    capturedOptions = {}
  })

  it('uses HuggingFace router base URL', async () => {
    mockCreate.mockResolvedValueOnce({ choices: [{ message: { content: 'reply' } }] })
    const { HuggingFaceScriptProvider } = await import('../../../server/worker/providers/script/huggingface')
    await new HuggingFaceScriptProvider().generate({
      job: {} as never, apiKey: 'hf-token', model: 'deepseek-ai/DeepSeek-V3',
      messages: [{ role: 'user', content: 'Hello' }],
    })
    expect(capturedOptions.apiKey).toBe('hf-token')
    expect(capturedOptions.baseURL).toBe('https://router.huggingface.co/v1')
  })

  it('returns text from completion', async () => {
    mockCreate.mockResolvedValueOnce({ choices: [{ message: { content: 'Generated script' } }] })
    const { HuggingFaceScriptProvider } = await import('../../../server/worker/providers/script/huggingface')
    const result = await new HuggingFaceScriptProvider().generate({
      job: {} as never, apiKey: 'k', model: 'meta-llama/Llama-3.3-70B-Instruct',
      messages: [{ role: 'user', content: 'Write a script' }],
    })
    expect(result.text).toBe('Generated script')
  })
})
