// @vitest-environment nuxt
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ExportStage from '../../../app/components/stages/ExportStage.vue'

function makeScene(id: string, index: number) {
  return {
    id,
    project_id: 'p1',
    job_id: null,
    scene_index: index,
    title: `Scene ${index + 1}`,
    script_text: `Script ${index + 1}`,
    start_time: index * 5,
    end_time: index * 5 + 5,
    duration: 5,
    order_index: index,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  }
}

interface ExportFetchOptions {
  skipVideoGen?: boolean
  exportCreatedAt?: string | null
  audioCreatedAt?: string | null
  videoCreatedAt?: string | null
  imageCreatedAt?: string | null
}

function stubExportFetch(options: ExportFetchOptions = {}) {
  const scenes = [makeScene('s1', 0), makeScene('s2', 1)]
  const exportCreatedAt = options.exportCreatedAt ?? '2026-01-05T00:00:00Z'
  const audioCreatedAt = options.audioCreatedAt ?? '2026-01-04T00:00:00Z'
  const videoCreatedAt = options.videoCreatedAt ?? '2026-01-04T00:00:00Z'
  const imageCreatedAt = options.imageCreatedAt ?? '2026-01-04T00:00:00Z'
  const manifestMode = (options.skipVideoGen ?? false) ? 'images_only' : 'video'

  vi.stubGlobal('$fetch', vi.fn(async (url: string) => {
    if (url === '/api/scenes') return scenes
    if (url === '/api/exports') {
      if (!exportCreatedAt) return []
      return [{
        id: 'exp-1',
        created_at: exportCreatedAt,
        export_type: 'mp4',
        storage_url: 'https://cdn.test/export.mp4',
        metadata: { manifest: { mode: manifestMode } },
      }]
    }
    if (url === '/api/audio') {
      return audioCreatedAt
        ? { url: 'https://cdn.test/audio.mp3', createdAt: audioCreatedAt, sceneSnapshot: null }
        : null
    }
    if (url === '/api/videos') {
      return scenes.map(scene => ({
        sceneId: scene.id,
        url: `https://cdn.test/${scene.id}.mp4`,
        createdAt: videoCreatedAt ?? '2026-01-04T00:00:00Z',
      }))
    }
    if (url === '/api/images') {
      return scenes.map(scene => ({
        sceneId: scene.id,
        url: `https://cdn.test/${scene.id}.png`,
        createdAt: imageCreatedAt ?? '2026-01-04T00:00:00Z',
      }))
    }
    throw new Error(`Unexpected fetch: ${url}`)
  }))
}

describe('ExportStage export staleness dot', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.stubEnv('NUXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co')
    vi.stubEnv('NUXT_PUBLIC_SUPABASE_KEY', 'test-key')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('does not show the dot when the latest export is newer than current media', async () => {
    stubExportFetch()
    const projectStore = useProjectStore()
    projectStore.settings = {
      skip_video_gen: false,
    } as typeof projectStore.settings

    const wrapper = mount(ExportStage, { props: { projectId: 'p1' } })
    await flushPromises()

    expect(wrapper.find('[data-testid="export-stale-dot"]').exists()).toBe(false)
  })

  it('shows the dot when a newer video would change the next MP4', async () => {
    stubExportFetch({ videoCreatedAt: '2026-01-06T00:00:00Z' })
    const projectStore = useProjectStore()
    projectStore.settings = {
      skip_video_gen: false,
    } as typeof projectStore.settings

    const wrapper = mount(ExportStage, { props: { projectId: 'p1' } })
    await flushPromises()

    expect(wrapper.find('[data-testid="export-stale-dot"]').exists()).toBe(true)
  })

  it('shows the dot when Skip Video Gen is enabled and a newer image would change the next MP4', async () => {
    stubExportFetch({
      skipVideoGen: true,
      imageCreatedAt: '2026-01-06T00:00:00Z',
    })
    const projectStore = useProjectStore()
    projectStore.settings = {
      skip_video_gen: true,
    } as typeof projectStore.settings

    const wrapper = mount(ExportStage, { props: { projectId: 'p1' } })
    await flushPromises()

    expect(wrapper.find('[data-testid="export-stale-dot"]').exists()).toBe(true)
  })

  it('shows the dot when the audio track is newer than the latest export', async () => {
    stubExportFetch({ audioCreatedAt: '2026-01-06T00:00:00Z' })
    const projectStore = useProjectStore()
    projectStore.settings = {
      skip_video_gen: false,
    } as typeof projectStore.settings

    const wrapper = mount(ExportStage, { props: { projectId: 'p1' } })
    await flushPromises()

    expect(wrapper.find('[data-testid="export-stale-dot"]').exists()).toBe(true)
  })
})
