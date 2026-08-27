// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ─────────────────────────────────────────────────────────────────

const mockUpdateJobStatus = vi.fn()
vi.mock('../../../server/worker/lib/jobs', () => ({
  updateJobStatus: mockUpdateJobStatus,
  storeTextOutput: vi.fn(),
  storeFileOutput: vi.fn(),
}))

vi.mock('../../../server/worker/lib/supabase', () => ({
  adminSupabase: { from: vi.fn() },
}))

const mockHandleScriptJob = vi.fn()
vi.mock('../../../server/worker/handlers/script', () => ({ handleScriptJob: mockHandleScriptJob }))
vi.mock('../../../server/worker/handlers/scene_split', () => ({ handleSceneSplitJob: vi.fn() }))
vi.mock('../../../server/worker/handlers/image_prompt', () => ({ handleImagePromptJob: vi.fn() }))
vi.mock('../../../server/worker/handlers/image', () => ({ handleImageJob: vi.fn() }))
vi.mock('../../../server/worker/handlers/audio', () => ({ handleAudioJob: vi.fn() }))
vi.mock('../../../server/worker/handlers/video_prompt', () => ({ handleVideoPromptJob: vi.fn() }))
vi.mock('../../../server/worker/handlers/video', () => ({ handleVideoJob: vi.fn() }))
vi.mock('../../../server/worker/handlers/export', () => ({ handleExportJob: vi.fn() }))

// ── Helpers ────────────────────────────────────────────────────────────────

const BASE_JOB = {
  id: 'job-1',
  project_id: 'proj-1',
  user_id: 'user-1',
  type: 'script',
  provider: null,
  model: null,
  retry_count: 0,
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('worker loop processJob (no automatic retry)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('fails immediately after one attempt — never transitions to retrying', async () => {
    mockHandleScriptJob.mockRejectedValueOnce(new Error('API rate limit'))
    const { processJob } = await import('../../../server/worker/loop')
    await processJob({ ...BASE_JOB } as never)

    expect(mockHandleScriptJob).toHaveBeenCalledTimes(1)
    expect(mockUpdateJobStatus).toHaveBeenCalledTimes(1)
    expect(mockUpdateJobStatus).toHaveBeenCalledWith('job-1', 'failed', { error_message: 'API rate limit', retry_count: 1 })
    expect(mockUpdateJobStatus).not.toHaveBeenCalledWith(expect.anything(), 'retrying', expect.anything())
  })

  it('fails immediately even when retry_count is already high (no lingering multi-attempt path)', async () => {
    mockHandleScriptJob.mockRejectedValueOnce(new Error('boom'))
    const { processJob } = await import('../../../server/worker/loop')
    await processJob({ ...BASE_JOB, retry_count: 2 } as never)

    expect(mockUpdateJobStatus).toHaveBeenCalledTimes(1)
    expect(mockUpdateJobStatus).toHaveBeenCalledWith('job-1', 'failed', { error_message: 'boom', retry_count: 3 })
    expect(mockUpdateJobStatus).not.toHaveBeenCalledWith(expect.anything(), 'retrying', expect.anything())
  })

  it('surfaces the exact human-readable "no API key" message verbatim', async () => {
    const message = 'No active API key found for provider "openai". Add one in Settings → API Keys.'
    mockHandleScriptJob.mockRejectedValueOnce(new Error(message))
    const { processJob } = await import('../../../server/worker/loop')
    await processJob({ ...BASE_JOB } as never)

    expect(mockUpdateJobStatus).toHaveBeenCalledWith('job-1', 'failed', { error_message: message, retry_count: 1 })
  })

  it('does not call updateJobStatus itself on success (the handler owns that)', async () => {
    mockHandleScriptJob.mockResolvedValueOnce(undefined)
    const { processJob } = await import('../../../server/worker/loop')
    await processJob({ ...BASE_JOB } as never)

    expect(mockUpdateJobStatus).not.toHaveBeenCalled()
  })

  it('fails immediately with an "Unknown job type" message for an unrecognized type', async () => {
    const { processJob } = await import('../../../server/worker/loop')
    await processJob({ ...BASE_JOB, type: 'bogus' } as never)

    expect(mockUpdateJobStatus).toHaveBeenCalledWith('job-1', 'failed', { error_message: 'Unknown job type: bogus' })
  })
})
