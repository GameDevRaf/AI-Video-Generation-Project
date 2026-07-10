// @vitest-environment nuxt
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
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

describe('useJobsStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('starts empty', () => {
    const store = useJobsStore()
    expect(Object.keys(store.activeJobs)).toHaveLength(0)
  })

  it('track adds job to activeJobs', () => {
    const store = useJobsStore()
    const job = makeJob()
    store.track(job)
    expect(store.getJob('job-1')).toMatchObject({ id: 'job-1', status: 'queued' })
  })

  it('getLatestByType returns matching job', () => {
    const store = useJobsStore()
    store.track(makeJob({ id: 'j1', type: 'script', project_id: 'proj-1' }))
    store.track(makeJob({ id: 'j2', type: 'audio', project_id: 'proj-1' }))
    const found = store.getLatestByType('proj-1', 'script')
    expect(found?.id).toBe('j1')
  })

  it('getLatestByType returns undefined for unknown type', () => {
    const store = useJobsStore()
    store.track(makeJob({ type: 'script' }))
    expect(store.getLatestByType('proj-1', 'audio')).toBeUndefined()
  })

  it('getLatestByType scopes by projectId', () => {
    const store = useJobsStore()
    store.track(makeJob({ id: 'j1', project_id: 'proj-A', type: 'script' }))
    store.track(makeJob({ id: 'j2', project_id: 'proj-B', type: 'script' }))
    expect(store.getLatestByType('proj-A', 'script')?.id).toBe('j1')
    expect(store.getLatestByType('proj-B', 'script')?.id).toBe('j2')
  })

  it('isRunning returns true for queued/processing/retrying', () => {
    const store = useJobsStore()
    for (const status of ['queued', 'processing', 'retrying'] as const) {
      setActivePinia(createPinia())
      const s = useJobsStore()
      s.track(makeJob({ status }))
      expect(s.isRunning('proj-1', 'script')).toBe(true)
    }
  })

  it('isRunning returns false for completed/failed', () => {
    const store = useJobsStore()
    for (const status of ['completed', 'failed'] as const) {
      setActivePinia(createPinia())
      const s = useJobsStore()
      s.track(makeJob({ status }))
      expect(s.isRunning('proj-1', 'script')).toBe(false)
    }
  })

  it('createJob calls POST /api/jobs and tracks result', async () => {
    const created = makeJob({ id: 'new-job', status: 'queued' })
    vi.stubGlobal('$fetch', vi.fn().mockResolvedValue(created))
    const store = useJobsStore()
    const job = await store.createJob('proj-1', 'script', { idea: 'test' })
    expect(job.id).toBe('new-job')
    expect(store.getJob('new-job')).toBeDefined()
  })

  it('retryJob calls POST /api/jobs/:id/retry and tracks the new job', async () => {
    const retried = makeJob({ id: 'new-job', status: 'queued' })
    const fetchMock = vi.fn().mockResolvedValue(retried)
    vi.stubGlobal('$fetch', fetchMock)
    const store = useJobsStore()
    const job = await store.retryJob('failed-job-1')
    expect(fetchMock).toHaveBeenCalledWith('/api/jobs/failed-job-1/retry', expect.objectContaining({ method: 'POST' }))
    expect(job.id).toBe('new-job')
    expect(store.getJob('new-job')).toBeDefined()
  })

  it('startPolling updates job status and stops on completed', async () => {
    const queued = makeJob({ status: 'queued' })
    const done = makeJob({ status: 'completed' })
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(queued)
      .mockResolvedValueOnce(done)
    vi.stubGlobal('$fetch', fetchMock)

    const store = useJobsStore()
    store.track(queued)

    const onDone = vi.fn()
    store.startPolling('job-1', onDone)

    await vi.runAllTimersAsync()
    await vi.runAllTimersAsync()

    expect(onDone).toHaveBeenCalledWith(expect.objectContaining({ status: 'completed' }))
  })

  it('cancelPoll stops the interval', async () => {
    const fetchMock = vi.fn().mockResolvedValue(makeJob({ status: 'queued' }))
    vi.stubGlobal('$fetch', fetchMock)
    const store = useJobsStore()
    store.track(makeJob())
    store.startPolling('job-1')
    store.cancelPoll('job-1')
    await vi.runAllTimersAsync()
    // fetch should NOT have been called — poll was cancelled before first tick
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('cancelAll clears all pollers and activeJobs', () => {
    const store = useJobsStore()
    store.track(makeJob({ id: 'j1' }))
    store.track(makeJob({ id: 'j2' }))
    vi.stubGlobal('$fetch', vi.fn().mockResolvedValue(makeJob({ status: 'queued' })))
    store.startPolling('j1')
    store.startPolling('j2')
    store.cancelAll()
    expect(Object.keys(store.activeJobs)).toHaveLength(0)
  })
})
