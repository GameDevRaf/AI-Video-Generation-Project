// @vitest-environment nuxt
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import ImageStage from '../../../app/components/stages/ImageStage.vue'
import ImageSceneCard from '../../../app/components/stages/ImageSceneCard.vue'

function makeScene(id: string, index: number) {
  return {
    id, project_id: 'p1', job_id: null, scene_index: index,
    title: `Scene ${index}`, script_text: 'text',
    start_time: index * 5, end_time: index * 5 + 5, duration: 5, order_index: index,
    created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
  }
}

describe('ImageStage — failures route to toast notifications', () => {
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
      if (url === '/api/image-prompts') return scenes.map(s => ({ sceneId: s.id, outputId: `out-${s.id}`, prompt: `prompt for ${s.id}` }))
      if (url === '/api/images') return []
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
    const wrapper = mount(ImageStage, { props: { projectId: 'p1' } })
    await vi.advanceTimersByTimeAsync(0)

    const s2Card = wrapper.findAllComponents(ImageSceneCard).find(c => c.props('scene').id === 's2')!
    const genButton = s2Card.findAll('button').find(b => b.text().includes('Gen image'))!
    await genButton.trigger('click')
    await vi.advanceTimersByTimeAsync(0)

    jobs['job-1'].status = 'failed'
    jobs['job-1'].error_message = 'Stability AI error 402: insufficient credits'
    await vi.advanceTimersByTimeAsync(2100)

    const toast = notifications.items.find(n => n.key === 'image:s2')!
    expect(toast).toBeDefined()
    expect(toast.heading).toBe('Payment Required · Scene 2')
    expect(toast.subheading).toBe('Code: 402')
    expect(toast.body).toBe('insufficient credits')
    // no toast leaked onto the other scene
    expect(notifications.items.find(n => n.key === 'image:s1')).toBeUndefined()

    await notifications.retry(toast.id)
    await vi.advanceTimersByTimeAsync(0)
    expect(fetchMock).toHaveBeenCalledWith('/api/jobs/job-1/retry', expect.objectContaining({ method: 'POST' }))
  })

  it('bulk "Generate all images" adds a summary toast that retries only the failed scenes', async () => {
    const scenes = [makeScene('s1', 0), makeScene('s2', 1)]
    const jobStatus: Record<string, { status: string; sceneId: string }> = {}
    let jobSeq = 0

    const fetchMock = vi.fn(async (url: string, opts?: { method?: string }) => {
      if (url === '/api/scenes') return scenes
      if (url === '/api/image-prompts') return scenes.map(s => ({ sceneId: s.id, outputId: `out-${s.id}`, prompt: `prompt for ${s.id}` }))
      if (url === '/api/images') return []
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
    const wrapper = mount(ImageStage, { props: { projectId: 'p1' } })
    await vi.advanceTimersByTimeAsync(0)

    const genAllButton = wrapper.findAll('button').find(b => b.text().includes('Generate all images'))!
    await genAllButton.trigger('click')
    await vi.advanceTimersByTimeAsync(0)

    const ids = Object.keys(jobStatus)
    expect(ids).toHaveLength(2)
    jobStatus[ids[0]!]!.status = 'completed'
    jobStatus[ids[1]!]!.status = 'failed'
    jobStatus[ids[1]!]!.sceneId = 's2'
    await vi.advanceTimersByTimeAsync(2100)

    const toast = notifications.items.find(n => n.key === 'image-bulk')!
    expect(toast).toBeDefined()
    expect(toast.heading).toBe('Some images failed to generate.')

    await notifications.retry(toast.id)
    await vi.advanceTimersByTimeAsync(0)
    expect(fetchMock).toHaveBeenCalledWith(`/api/jobs/${ids[1]}/retry`, expect.objectContaining({ method: 'POST' }))

    const newId = Object.keys(jobStatus).find(id => !ids.includes(id))!
    jobStatus[newId]!.status = 'completed'
    await vi.advanceTimersByTimeAsync(2100)
    expect(notifications.items.find(n => n.key === 'image-bulk')).toBeUndefined()
  })
})
