// @vitest-environment nuxt
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import type { DbJob } from '~/types/database.types'

function makeJob(overrides: Partial<DbJob> = {}): DbJob {
  return {
    id: 'job-1',
    user_id: 'user-1',
    project_id: 'proj-1',
    type: 'script',
    status: 'queued',
    provider: null,
    model: null,
    input: null,
    output_summary: null,
    error_message: null,
    retry_count: 0,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    started_at: null,
    completed_at: null,
    ...overrides,
  }
}

describe('useJobPoller', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('startJob POSTs to /api/jobs and starts polling', async () => {
    const created = makeJob({ status: 'queued' })
    vi.stubGlobal('$fetch', vi.fn().mockResolvedValue(created))
    const poller = useJobPoller()
    await poller.startJob('proj-1', 'script', { idea: 'x' })
    expect(poller.job.value?.id).toBe('job-1')
    expect(poller.polling.value).toBe(true)
  })

  it('retryJob POSTs to /api/jobs/:id/retry and starts polling the new job', async () => {
    const retried = makeJob({ id: 'job-2', status: 'queued' })
    const fetchMock = vi.fn().mockResolvedValue(retried)
    vi.stubGlobal('$fetch', fetchMock)
    const poller = useJobPoller()

    const result = await poller.retryJob('job-1')

    expect(fetchMock).toHaveBeenCalledWith('/api/jobs/job-1/retry', expect.objectContaining({ method: 'POST' }))
    expect(result?.id).toBe('job-2')
    expect(poller.job.value?.id).toBe('job-2')
    expect(poller.polling.value).toBe(true)
  })

  it('retryJob forwards overrides in the request body', async () => {
    const fetchMock = vi.fn().mockResolvedValue(makeJob())
    vi.stubGlobal('$fetch', fetchMock)
    const poller = useJobPoller()
    await poller.retryJob('job-1', { provider: 'openai', model: 'gpt-4.1' })
    expect(fetchMock).toHaveBeenCalledWith('/api/jobs/job-1/retry', expect.objectContaining({
      body: { provider: 'openai', model: 'gpt-4.1' },
    }))
  })

  it('retryJob is a no-op while already starting or polling (re-entrancy guard)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(makeJob())
    vi.stubGlobal('$fetch', fetchMock)
    const poller = useJobPoller()
    await poller.startJob('proj-1', 'script', {})
    fetchMock.mockClear()

    await poller.retryJob('job-1')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('polling picks up the retried job and resolves isFailed/isDone as it progresses', async () => {
    const retried = makeJob({ id: 'job-2', status: 'queued' })
    const completed = makeJob({ id: 'job-2', status: 'completed' })
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(retried)
      .mockResolvedValueOnce(completed)
    vi.stubGlobal('$fetch', fetchMock)
    const poller = useJobPoller()

    await poller.retryJob('job-1')
    expect(poller.isFailed.value).toBe(false)

    await vi.advanceTimersByTimeAsync(2000)
    expect(poller.job.value?.status).toBe('completed')
    expect(poller.isDone.value).toBe(true)
    expect(poller.polling.value).toBe(false)
  })
})
