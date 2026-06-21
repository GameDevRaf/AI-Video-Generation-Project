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

const allScenes = [
  { id: 'scene-1', title: 'One', script_text: 'First scene', duration: 4 },
  { id: 'scene-2', title: 'Two', script_text: 'Second scene', duration: 5 },
]

let sceneFilterId: string | null = null

const sceneQuery = {
  select: vi.fn(() => sceneQuery),
  eq: vi.fn((field: string, value: string) => {
    if (field === 'id') sceneFilterId = value
    return sceneQuery
  }),
  order: vi.fn(async () => ({
    data: sceneFilterId ? allScenes.filter(scene => scene.id === sceneFilterId) : allScenes,
  })),
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
  id: 'job-video-prompt',
  project_id: 'project-1',
  user_id: 'user-1',
  provider: 'anthropic',
  model: null,
}

describe('video prompt handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sceneFilterId = null
  })

  it.each(['anthropic', 'openai', 'gemini', 'groq', 'mistral'])(
    'uses selected script provider %s when regenerating one scene',
    async (provider) => {
      mockScriptGenerate.mockResolvedValueOnce({
        text: JSON.stringify([{ scene_id: 'scene-2', prompt: `${provider} motion` }]),
      })

      const { handleVideoPromptJob } = await import('../../../server/worker/handlers/video_prompt')
      await handleVideoPromptJob({
        ...BASE_JOB,
        provider,
        input: { scene_id: 'scene-2' },
      } as never)

      expect(mockRegistryScript).toHaveBeenCalledWith(provider)
      expect(mockGetProviderKey).toHaveBeenCalledWith(provider, 'user-1')
      expect(mockStoreTextOutput).toHaveBeenCalledTimes(1)
      expect(mockStoreTextOutput).toHaveBeenCalledWith(
        expect.anything(),
        `${provider} motion`,
        'video_prompt_scene_scene-2',
      )

      const providerInput = mockScriptGenerate.mock.calls[0][0].messages[0].content
      expect(providerInput).toContain('scene-2')
      expect(providerInput).not.toContain('scene-1')
    },
  )

  it('stores prompts for all scenes when no scene id is provided', async () => {
    mockScriptGenerate.mockResolvedValueOnce({
      text: JSON.stringify([
        { scene_id: 'scene-1', prompt: 'First motion' },
        { scene_id: 'scene-2', prompt: 'Second motion' },
      ]),
    })

    const { handleVideoPromptJob } = await import('../../../server/worker/handlers/video_prompt')
    await handleVideoPromptJob({ ...BASE_JOB, input: {} } as never)

    expect(mockStoreTextOutput).toHaveBeenCalledTimes(2)
    expect(mockStoreTextOutput.mock.calls.map(call => call[2])).toEqual([
      'video_prompt_scene_scene-1',
      'video_prompt_scene_scene-2',
    ])
  })
})
