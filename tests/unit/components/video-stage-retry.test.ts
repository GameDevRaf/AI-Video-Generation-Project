// @vitest-environment nuxt
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import VideoStage from '../../../app/components/stages/VideoStage.vue'
import VideoSceneCard from '../../../app/components/stages/VideoSceneCard.vue'

function makeScene(id: string, index: number) {
  return {
    id, project_id: 'p1', job_id: null, scene_index: index,
    title: `Scene ${index}`, script_text: 'text',
    start_time: index * 5, end_time: index * 5 + 5, duration: 5, order_index: index,
    created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
  }
}

describe('VideoStage — failures route to toast notifications', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('single-scene failure adds a scene-labelled toast whose Retry re-runs just that job', async () => {
    const scenes = [makeScene('s1', 0), makeScene('s2', 1)]
    const jobs: Record<string, { id: string; status: string; error_message?: string | null }> = {}

    const fetchMock = vi.fn(async (url: string, opts?: { method?: string }) => {
      if (url === '/api/scenes') return scenes
      if (url === '/api/video-prompts') return scenes.map(s => ({ sceneId: s.id, outputId: `out-${s.id}`, prompt: `motion for ${s.id}` }))
      if (url === '/api/videos' || url === '/api/images') return []
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
    const wrapper = mount(VideoStage, { props: { projectId: 'p1' } })
    await vi.advanceTimersByTimeAsync(0)

    const s2Card = wrapper.findAllComponents(VideoSceneCard).find(c => c.props('scene').id === 's2')!
    const genButton = s2Card.findAll('button').find(b => b.text().includes('Gen video'))!
    await genButton.trigger('click')
    await vi.advanceTimersByTimeAsync(0)

    jobs['job-1'].status = 'failed'
    jobs['job-1'].error_message = 'Runway error 400: imageUrl is required'
    await vi.advanceTimersByTimeAsync(2100)

    const toast = notifications.items.find(n => n.key === 'video:s2')!
    expect(toast).toBeDefined()
    expect(toast.heading).toBe('Bad Request · Scene 2')
    expect(toast.subheading).toBe('Code: 400')
    expect(notifications.items.find(n => n.key === 'video:s1')).toBeUndefined()

    await notifications.retry(toast.id)
    await vi.advanceTimersByTimeAsync(0)
    expect(fetchMock).toHaveBeenCalledWith('/api/jobs/job-1/retry', expect.objectContaining({ method: 'POST' }))
  })

  it('bulk "Generate all videos" adds a summary toast that retries only the failed scenes', async () => {
    const scenes = [makeScene('s1', 0), makeScene('s2', 1)]
    const jobStatus: Record<string, { status: string; sceneId: string }> = {}
    let jobSeq = 0

    const fetchMock = vi.fn(async (url: string, opts?: { method?: string }) => {
      if (url === '/api/scenes') return scenes
      if (url === '/api/video-prompts') return scenes.map(s => ({ sceneId: s.id, outputId: `out-${s.id}`, prompt: `motion for ${s.id}` }))
      if (url === '/api/videos' || url === '/api/images') return []
      if (url === '/api/jobs' && opts?.method === 'POST') {
        jobSeq += 1
        const id = `job-${jobSeq}`
        jobStatus[id] = { status: 'queued', sceneId: '' }
        return { id, status: 'queued' }
      }
      if (url.endsWith('/retry') && opts?.method === 'POST') {
        const oldId = url.split('/')[3]!
        jobSeq += 1
        const newId = `job-${jobSeq}`
        jobStatus[newId] = { status: 'queued', sceneId: jobStatus[oldId]!.sceneId }
        return { id: newId, status: 'queued' }
      }
      if (url.startsWith('/api/jobs/')) {
        const id = url.split('/').pop()!
        return { id, status: jobStatus[id]?.status }
      }
      throw new Error(`Unexpected fetch: ${url}`)
    })
    vi.stubGlobal('$fetch', fetchMock)

    const notifications = useNotificationsStore()
    const wrapper = mount(VideoStage, { props: { projectId: 'p1' } })
    await vi.advanceTimersByTimeAsync(0)

    const genAllButton = wrapper.findAll('button').find(b => b.text().includes('Generate all videos'))!
    await genAllButton.trigger('click')
    await vi.advanceTimersByTimeAsync(0)

    const ids = Object.keys(jobStatus)
    expect(ids).toHaveLength(2)
    jobStatus[ids[0]!]!.status = 'completed'
    jobStatus[ids[1]!]!.status = 'failed'
    jobStatus[ids[1]!]!.sceneId = 's2'
    await vi.advanceTimersByTimeAsync(2100)

    const toast = notifications.items.find(n => n.key === 'video-bulk')!
    expect(toast).toBeDefined()
    expect(toast.heading).toBe('Some videos failed to generate.')

    await notifications.retry(toast.id)
    await vi.advanceTimersByTimeAsync(0)
    expect(fetchMock).toHaveBeenCalledWith(`/api/jobs/${ids[1]}/retry`, expect.objectContaining({ method: 'POST' }))
  })
})
