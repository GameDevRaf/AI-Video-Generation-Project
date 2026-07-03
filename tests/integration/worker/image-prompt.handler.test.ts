// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockScriptGenerate = vi.fn()
const mockRegistryScript = vi.fn(() => ({ generate: mockScriptGenerate }))
vi.mock('../../../server/worker/providers/registry', () => ({
  providerRegistry: { script: mockRegistryScript },
}))

const mockGetProviderKey = vi.fn().mockResolvedValue('provider-key')
vi.mock('../../../server/worker/lib/getProviderKey', () => ({
  getProviderKey: mockGetProviderKey,
}))

const mockStoreTextOutput = vi.fn().mockResolvedValue('out-1')
const mockUpdateJobStatus = vi.fn()
vi.mock('../../../server/worker/lib/jobs', () => ({
  storeTextOutput: mockStoreTextOutput,
  updateJobStatus: mockUpdateJobStatus,
}))

// The visual-description step is exercised by its own test; here it's stubbed so
// the handler receives a ready-made anchor + per-scene descriptions.
const mockEnsureVisualDescriptions = vi.fn()
vi.mock('../../../server/worker/lib/visualDescriptions', () => ({
  ensureVisualDescriptions: mockEnsureVisualDescriptions,
}))

const allScenes = [
  { id: 'scene-1', title: 'One', script_text: 'First scene' },
  { id: 'scene-2', title: 'Two', script_text: 'Second scene' },
]

const sceneQuery = {
  select: vi.fn(() => sceneQuery),
  eq: vi.fn(() => sceneQuery),
  order: vi.fn(async () => ({ data: allScenes })),
}

const userSettingsQuery = {
  select: vi.fn(() => userSettingsQuery),
  eq: vi.fn(() => userSettingsQuery),
  single: vi.fn(async () => ({ data: { default_script_provider: 'anthropic' } })),
}

const mockFrom = vi.fn((table: string) => {
  if (table === 'scenes') return sceneQuery
  if (table === 'user_settings') return userSettingsQuery
  return {}
})

vi.mock('../../../server/worker/lib/supabase', () => ({
  adminSupabase: { from: mockFrom },
}))

const BASE_JOB = {
  id: 'job-image-prompt',
  project_id: 'project-1',
  user_id: 'user-1',
  provider: 'anthropic',
  model: null,
}

describe('image prompt handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockEnsureVisualDescriptions.mockResolvedValue({
      anchor: 'ANCHOR: warm hand-drawn style',
      byScene: new Map([
        ['scene-1', 'desc one'],
        ['scene-2', 'desc two'],
      ]),
    })
  })

  it.each(['anthropic', 'openai', 'gemini', 'groq', 'mistral'])(
    'uses selected script provider %s when regenerating one scene',
    async (provider) => {
      mockScriptGenerate.mockResolvedValueOnce({
        text: JSON.stringify([{ scene_id: 'scene-2', prompt: `${provider} image` }]),
      })

      const { handleImagePromptJob } = await import('../../../server/worker/handlers/image_prompt')
      await handleImagePromptJob({
        ...BASE_JOB,
        provider,
        input: { scene_id: 'scene-2' },
      } as never)

      expect(mockRegistryScript).toHaveBeenCalledWith(provider)
      expect(mockGetProviderKey).toHaveBeenCalledWith(provider, 'user-1')
      expect(mockStoreTextOutput).toHaveBeenCalledTimes(1)
      expect(mockStoreTextOutput).toHaveBeenCalledWith(
        expect.anything(),
        `${provider} image`,
        'image_prompt_scene_scene-2',
      )

      const providerInput = mockScriptGenerate.mock.calls[0][0].messages[0].content
      expect(providerInput).toContain('scene-2')
      expect(providerInput).not.toContain('scene-1')
    },
  )

  it('ensures visual descriptions first and builds the prompt from them (not raw script_text)', async () => {
    mockScriptGenerate.mockResolvedValueOnce({
      text: JSON.stringify([{ scene_id: 'scene-2', prompt: 'img' }]),
    })

    const { handleImagePromptJob } = await import('../../../server/worker/handlers/image_prompt')
    await handleImagePromptJob({ ...BASE_JOB, input: { scene_id: 'scene-2' } } as never)

    expect(mockEnsureVisualDescriptions).toHaveBeenCalledTimes(1)
    // description feeds the user message; the anchor feeds the system prompt
    const call = mockScriptGenerate.mock.calls[0][0]
    expect(call.messages[0].content).toContain('desc two')
    expect(call.messages[0].content).not.toContain('Second scene')
    expect(call.systemPrompt).toContain('ANCHOR')
  })
})
