// @vitest-environment nuxt
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import ScriptStage from '../../../app/components/stages/ScriptStage.vue'
import { useProjectStore } from '../../../app/stores/project'
import type { DbProject } from '../../../app/types/database.types'

function makeProject(): DbProject {
  return {
    id: 'p1',
    user_id: 'u1',
    name: 'Test project',
    description: null,
    status: 'active',
    current_stage: 'script',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  }
}

describe('ScriptStage — failed job routes to a toast notification', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('adds a parsed error toast on failure whose Retry re-runs the job, then dismisses on success', async () => {
    const jobs: Record<string, { id: string; status: string; error_message?: string | null }> = {}
    const fetchMock = vi.fn(async (url: string, opts?: { method?: string }) => {
      if (url === '/api/jobs' && opts?.method === 'POST') {
        jobs['job-1'] = { id: 'job-1', status: 'queued' }
        return jobs['job-1']
      }
      if (url === '/api/jobs/job-1/retry' && opts?.method === 'POST') {
        jobs['job-2'] = { id: 'job-2', status: 'queued' }
        return jobs['job-2']
      }
      if (url.startsWith('/api/jobs/')) {
        const id = url.split('/').pop()!
        return { ...jobs[id], job_outputs: [] }
      }
      throw new Error(`Unexpected fetch: ${url}`)
    })
    vi.stubGlobal('$fetch', fetchMock)

    const projectStore = useProjectStore()
    projectStore.currentProject = makeProject()
    const notifications = useNotificationsStore()

    const wrapper = mount(ScriptStage, { props: { projectId: 'p1' } })
    await vi.advanceTimersByTimeAsync(0)

    await wrapper.get('#idea').setValue('A documentary about cats')
    const generateButton = wrapper.findAll('button').find(b => b.text().includes('Generate scripts'))!
    await generateButton.trigger('click')
    await vi.advanceTimersByTimeAsync(0)

    expect(notifications.items).toHaveLength(0)

    // Worker fails the job with a specific, human-readable message
    jobs['job-1'].status = 'failed'
    jobs['job-1'].error_message = 'Nano Banana (Gemini image) error 429: {"error":{"code":429,"message":"You exceeded your quota","status":"RESOURCE_EXHAUSTED"}}'
    await vi.advanceTimersByTimeAsync(2100)

    const toast = notifications.items.find(n => n.key === 'script')!
    expect(toast).toBeDefined()
    expect(toast.heading).toBe('RESOURCE_EXHAUSTED')
    expect(toast.subheading).toBe('Code: 429')
    expect(toast.body).toBe('You exceeded your quota')

    // Invoking the toast's retry action re-runs the job via the retry endpoint
    await notifications.retry(toast.id)
    await vi.advanceTimersByTimeAsync(0)
    expect(fetchMock).toHaveBeenCalledWith('/api/jobs/job-1/retry', expect.objectContaining({ method: 'POST' }))

    // The retried job completes → the toast is dismissed
    jobs['job-2'].status = 'completed'
    await vi.advanceTimersByTimeAsync(2100)
    expect(notifications.items.find(n => n.key === 'script')).toBeUndefined()
  })
})
