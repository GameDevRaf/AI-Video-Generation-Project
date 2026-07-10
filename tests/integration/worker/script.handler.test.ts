// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ─────────────────────────────────────────────────────────────────

const mockScriptGenerate = vi.fn()
vi.mock('../../../server/worker/providers/registry', () => ({
  providerRegistry: { script: () => ({ generate: mockScriptGenerate }) },
}))

const mockGetProviderKey = vi.fn().mockResolvedValue('test-api-key')
vi.mock('../../../server/worker/lib/getProviderKey', () => ({
  getProviderKey: mockGetProviderKey,
}))

const mockUpdateJobStatus = vi.fn()
const mockStoreTextOutput = vi.fn().mockResolvedValue('out-1')
vi.mock('../../../server/worker/lib/jobs', () => ({
  updateJobStatus: mockUpdateJobStatus,
  storeTextOutput: mockStoreTextOutput,
  storeFileOutput: vi.fn(),
}))

// adminSupabase mock — supports user_settings lookup for resolveScriptProvider
const mockUserSettingsSingle = vi.fn().mockResolvedValue({ data: { default_script_provider: 'anthropic' } })
const mockUserSettingsEq = vi.fn(() => ({ single: mockUserSettingsSingle }))
const mockUserSettingsSelect = vi.fn(() => ({ eq: mockUserSettingsEq }))
vi.mock('../../../server/worker/lib/supabase', () => ({
  adminSupabase: { from: vi.fn(() => ({ select: mockUserSettingsSelect })) },
}))

// ── Helpers ────────────────────────────────────────────────────────────────

const THREE_SCRIPTS = 'Script A\n---SCRIPT_BREAK---\nScript B\n---SCRIPT_BREAK---\nScript C'

const BASE_JOB = {
  id: 'job-1',
  project_id: 'proj-1',
  user_id: 'user-1',
  provider: null,
  model: null,
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('script handler', () => {
  beforeEach(() => vi.clearAllMocks())

  it('fetches an API key for the resolved provider', async () => {
    mockScriptGenerate.mockResolvedValueOnce({ text: THREE_SCRIPTS })
    const { handleScriptJob } = await import('../../../server/worker/handlers/script')
    await handleScriptJob({ ...BASE_JOB, input: { idea: 'Cats', tone: 'Documentary' } } as never)
    expect(mockGetProviderKey).toHaveBeenCalledWith('anthropic', 'user-1')
  })

  it('forwards idea and tone to provider via userMessage', async () => {
    mockScriptGenerate.mockResolvedValueOnce({ text: THREE_SCRIPTS })
    const { handleScriptJob } = await import('../../../server/worker/handlers/script')
    await handleScriptJob({ ...BASE_JOB, input: { idea: 'A documentary about cats', tone: 'Documentary' } } as never)
    const callArg = mockScriptGenerate.mock.calls[0][0]
    expect(callArg.messages[0].content).toContain('A documentary about cats')
    expect(callArg.messages[0].content).toContain('Documentary')
  })

  it('stores three separate candidates on success', async () => {
    mockScriptGenerate.mockResolvedValueOnce({ text: THREE_SCRIPTS })
    const { handleScriptJob } = await import('../../../server/worker/handlers/script')
    await handleScriptJob({ ...BASE_JOB, input: { idea: 'Ocean life', tone: 'Educational' } } as never)
    expect(mockStoreTextOutput).toHaveBeenCalledTimes(3)
    const labels = mockStoreTextOutput.mock.calls.map((c: unknown[]) => c[2] as string)
    expect(labels).toContain('script_candidate_1')
    expect(labels).toContain('script_candidate_2')
    expect(labels).toContain('script_candidate_3')
  })

  it('marks job completed after successful generation', async () => {
    mockScriptGenerate.mockResolvedValueOnce({ text: 'S1\n---SCRIPT_BREAK---\nS2\n---SCRIPT_BREAK---\nS3' })
    const { handleScriptJob } = await import('../../../server/worker/handlers/script')
    await handleScriptJob({ ...BASE_JOB, input: { idea: 'x', tone: 'Narrative' } } as never)
    expect(mockUpdateJobStatus).toHaveBeenCalledWith('job-1', 'completed', expect.anything())
  })

  it('stores one output labeled script_refined when refining', async () => {
    mockScriptGenerate.mockResolvedValueOnce({ text: 'Refined text' })
    const { handleScriptJob } = await import('../../../server/worker/handlers/script')
    await handleScriptJob({
      ...BASE_JOB,
      id: 'job-2',
      input: { existing_script: 'Original', refinement_instructions: 'Shorter' },
    } as never)
    expect(mockStoreTextOutput).toHaveBeenCalledTimes(1)
    expect(mockStoreTextOutput.mock.calls[0][2]).toBe('script_refined')
  })

  it('passes refinement content to provider', async () => {
    mockScriptGenerate.mockResolvedValueOnce({ text: 'Refined script text' })
    const { handleScriptJob } = await import('../../../server/worker/handlers/script')
    await handleScriptJob({
      ...BASE_JOB,
      input: { existing_script: 'Original draft', refinement_instructions: 'Make it shorter' },
    } as never)
    const callArg = mockScriptGenerate.mock.calls[0][0]
    expect(callArg.messages[0].content).toContain('Original draft')
    expect(callArg.messages[0].content).toContain('Make it shorter')
  })

  it('includes the requested target length in the system prompt', async () => {
    mockScriptGenerate.mockResolvedValueOnce({ text: THREE_SCRIPTS })
    const { handleScriptJob } = await import('../../../server/worker/handlers/script')
    await handleScriptJob({
      ...BASE_JOB,
      input: { idea: 'x', tone: 'y', target_duration_seconds: 60 },
    } as never)
    const callArg = mockScriptGenerate.mock.calls[0][0]
    expect(callArg.systemPrompt).toContain('130 words')
    expect(callArg.systemPrompt).toContain('~60s')
  })

  it('defaults the target length to 180s when not provided', async () => {
    mockScriptGenerate.mockResolvedValueOnce({ text: THREE_SCRIPTS })
    const { handleScriptJob } = await import('../../../server/worker/handlers/script')
    await handleScriptJob({ ...BASE_JOB, input: { idea: 'x', tone: 'y' } } as never)
    const callArg = mockScriptGenerate.mock.calls[0][0]
    expect(callArg.systemPrompt).toContain('~180s')
  })

  it('clamps a target length above the 180s ceiling', async () => {
    mockScriptGenerate.mockResolvedValueOnce({ text: THREE_SCRIPTS })
    const { handleScriptJob } = await import('../../../server/worker/handlers/script')
    await handleScriptJob({
      ...BASE_JOB,
      input: { idea: 'x', tone: 'y', target_duration_seconds: 600 },
    } as never)
    const callArg = mockScriptGenerate.mock.calls[0][0]
    expect(callArg.systemPrompt).toContain('~180s')
    expect(callArg.systemPrompt).not.toContain('~600s')
  })

  it('propagates error from provider (loop.ts fails the job — no automatic retry)', async () => {
    mockScriptGenerate.mockRejectedValueOnce(new Error('API rate limit'))
    const { handleScriptJob } = await import('../../../server/worker/handlers/script')
    await expect(
      handleScriptJob({ ...BASE_JOB, input: { idea: 'x', tone: 'y' } } as never)
    ).rejects.toThrow('API rate limit')
    expect(mockUpdateJobStatus).not.toHaveBeenCalledWith(expect.anything(), 'failed', expect.anything())
  })
})
