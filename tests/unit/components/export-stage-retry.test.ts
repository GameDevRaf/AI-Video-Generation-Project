// @vitest-environment nuxt
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import ExportStage from '../../../app/components/stages/ExportStage.vue'

function makeScene(id: string, index: number) {
  return {
    id, project_id: 'p1', job_id: null, scene_index: index,
    title: `Scene ${index}`, script_text: 'text',
    start_time: index * 5, end_time: index * 5 + 5, duration: 5, order_index: index,
    created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
  }
}

describe('ExportStage — failed job routes to a toast notification', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('adds a toast on export failure whose Retry re-runs the export job', async () => {
    const scenes = [makeScene('s1', 0)]
    const jobs: Record<string, { id: string; status: string; error_message?: string | null }> = {}

    const fetchMock = vi.fn(async (url: string, opts?: { method?: string }) => {
      if (url === '/api/scenes') return scenes
      if (url === '/api/exports') return []
      if (url === '/api/audio') return null
      if (url === '/api/videos' || url === '/api/images') {
        return [{ sceneId: 's1', url: 'https://cdn.test/s1.mp4', generationPrompt: 'p', createdAt: '2026-01-01T00:00:00Z' }]
      }
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
    const wrapper = mount(ExportStage, { props: { projectId: 'p1' } })
    await vi.advanceTimersByTimeAsync(0)

    const exportButton = wrapper.findAll('button').find(b => b.text().includes('Export MP4'))!
    await exportButton.trigger('click')
    await vi.advanceTimersByTimeAsync(0)

    jobs['job-1'].status = 'failed'
    jobs['job-1'].error_message = 'ffmpeg exited with code 1: no audio stream found'
    await vi.advanceTimersByTimeAsync(2100)

    const toast = notifications.items.find(n => n.key === 'export')!
    expect(toast).toBeDefined()
    expect(toast.body).toContain('ffmpeg exited with code 1')

    await notifications.retry(toast.id)
    await vi.advanceTimersByTimeAsync(0)
    expect(fetchMock).toHaveBeenCalledWith('/api/jobs/job-1/retry', expect.objectContaining({ method: 'POST' }))
  })
})
