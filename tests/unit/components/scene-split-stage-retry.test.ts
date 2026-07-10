// @vitest-environment nuxt
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import SceneSplitStage from '../../../app/components/stages/SceneSplitStage.vue'

describe('SceneSplitStage — failed job routes to a toast notification', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('adds a toast on failure whose Retry re-runs the scene_split job', async () => {
    const jobs: Record<string, { id: string; status: string; error_message?: string | null }> = {}
    const fetchMock = vi.fn(async (url: string, opts?: { method?: string }) => {
      if (url === '/api/scenes') return []
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

    const notifications = useNotificationsStore()
    const wrapper = mount(SceneSplitStage, { props: { projectId: 'p1', scriptText: 'Once upon a time.' } })
    await vi.advanceTimersByTimeAsync(0)

    const splitButton = wrapper.findAll('button').find(b => b.text().includes('Split into scenes'))!
    await splitButton.trigger('click')
    await vi.advanceTimersByTimeAsync(0)

    jobs['job-1'].status = 'failed'
    jobs['job-1'].error_message = 'Provider returned malformed JSON.'
    await vi.advanceTimersByTimeAsync(2100)

    const toast = notifications.items.find(n => n.key === 'scene_split')!
    expect(toast).toBeDefined()
    expect(toast.body).toBe('Provider returned malformed JSON.')

    await notifications.retry(toast.id)
    await vi.advanceTimersByTimeAsync(0)
    expect(fetchMock).toHaveBeenCalledWith('/api/jobs/job-1/retry', expect.objectContaining({ method: 'POST' }))
  })
})
