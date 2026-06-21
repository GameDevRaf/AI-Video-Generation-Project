// @vitest-environment node
/**
 * Integration tests for the script worker handler.
 * Mocks Anthropic SDK and the Supabase admin client so no real network calls happen.
 * Tests: message construction, response parsing, output storage, status transitions.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ─────────────────────────────────────────────────────────────────

const mockCreate = vi.fn()
vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = { create: mockCreate }
  },
}))

const mockUpdateJobStatus = vi.fn()
const mockStoreTextOutput = vi.fn().mockResolvedValue({ id: 'out-1' })
vi.mock('../../../server/worker/lib/jobs', () => ({
  updateJobStatus: mockUpdateJobStatus,
  storeTextOutput: mockStoreTextOutput,
  storeFileOutput: vi.fn(),
}))

vi.mock('../../../server/worker/lib/supabase', () => ({
  adminSupabase: {},
}))

// ── Tests ──────────────────────────────────────────────────────────────────

describe('script handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.ANTHROPIC_API_KEY = 'test-key'
  })

  it('calls Claude with idea and tone from job input', async () => {
    const THREE_SCRIPTS = 'Script A\n---SCRIPT_BREAK---\nScript B\n---SCRIPT_BREAK---\nScript C'
    mockCreate.mockResolvedValueOnce({ content: [{ type: 'text', text: THREE_SCRIPTS }] })

    const { handleScriptJob } = await import('../../../server/worker/handlers/script')
    const job = {
      id: 'job-1', project_id: 'proj-1',
      input: { idea: 'A documentary about cats', tone: 'Documentary' },
    }
    await handleScriptJob(job as never)

    expect(mockCreate).toHaveBeenCalledOnce()
    const callArg = mockCreate.mock.calls[0][0]
    expect(callArg.messages[0].content).toContain('A documentary about cats')
    expect(callArg.messages[0].content).toContain('Documentary')
  })

  it('stores three separate candidates on success', async () => {
    const THREE_SCRIPTS = 'Script A\n---SCRIPT_BREAK---\nScript B\n---SCRIPT_BREAK---\nScript C'
    mockCreate.mockResolvedValueOnce({ content: [{ type: 'text', text: THREE_SCRIPTS }] })

    const { handleScriptJob } = await import('../../../server/worker/handlers/script')
    const job = {
      id: 'job-1', project_id: 'proj-1',
      input: { idea: 'Ocean life', tone: 'Educational' },
    }
    await handleScriptJob(job as never)

    // storeTextOutput(job, text, label) — label is arg index 2
    expect(mockStoreTextOutput).toHaveBeenCalledTimes(3)
    const labels = mockStoreTextOutput.mock.calls.map((c: unknown[]) => c[2] as string)
    expect(labels).toContain('script_candidate_1')
    expect(labels).toContain('script_candidate_2')
    expect(labels).toContain('script_candidate_3')
  })

  it('marks job completed after successful generation', async () => {
    const THREE_SCRIPTS = 'S1\n---SCRIPT_BREAK---\nS2\n---SCRIPT_BREAK---\nS3'
    mockCreate.mockResolvedValueOnce({ content: [{ type: 'text', text: THREE_SCRIPTS }] })

    const { handleScriptJob } = await import('../../../server/worker/handlers/script')
    await handleScriptJob({ id: 'job-1', project_id: 'proj-1', input: { idea: 'x', tone: 'Narrative' } } as never)

    expect(mockUpdateJobStatus).toHaveBeenCalledWith('job-1', 'completed', expect.anything())
  })

  it('calls Claude with refinement_instructions when refining', async () => {
    mockCreate.mockResolvedValueOnce({ content: [{ type: 'text', text: 'Refined script text' }] })

    const { handleScriptJob } = await import('../../../server/worker/handlers/script')
    const job = {
      id: 'job-2', project_id: 'proj-1',
      input: {
        existing_script: 'Original draft',
        refinement_instructions: 'Make it shorter',
      },
    }
    await handleScriptJob(job as never)

    const callArg = mockCreate.mock.calls[0][0]
    expect(callArg.messages[0].content).toContain('Original draft')
    expect(callArg.messages[0].content).toContain('Make it shorter')
  })

  it('propagates error when Claude throws (worker handles retry)', async () => {
    mockCreate.mockRejectedValueOnce(new Error('API rate limit'))

    const { handleScriptJob } = await import('../../../server/worker/handlers/script')
    await expect(
      handleScriptJob({ id: 'job-err', project_id: 'proj-1', input: { idea: 'x', tone: 'y' } } as never)
    ).rejects.toThrow('API rate limit')
    // updateJobStatus is NOT called by the handler itself on error — the worker retry loop handles it
    expect(mockUpdateJobStatus).not.toHaveBeenCalledWith(expect.anything(), 'failed', expect.anything())
  })
})
