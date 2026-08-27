// @vitest-environment nuxt
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { useSceneOrderSync } from '../../../app/composables/useSceneOrderSync'

function makeScene(id: string, orderIndex: number, scriptText = id) {
  return {
    id,
    project_id: 'p1',
    job_id: null,
    scene_index: orderIndex,
    title: `Scene ${orderIndex + 1}`,
    script_text: scriptText,
    start_time: orderIndex * 5,
    end_time: orderIndex * 5 + 5,
    duration: 5,
    order_index: orderIndex,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  }
}

let projectCounter = 0

function nextProjectId() {
  projectCounter += 1
  return `project-${projectCounter}`
}

describe('useSceneOrderSync', () => {
  beforeEach(() => {
    vi.stubGlobal('$fetch', vi.fn(async () => ({ ok: true })))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('flushes a pending reorder once and rebuilds the combined audio track', async () => {
    const projectId = ref(nextProjectId())
    const sync = useSceneOrderSync(projectId)
    const original = [makeScene('s1', 0), makeScene('s2', 1)]
    const reordered = [makeScene('s2', 0), makeScene('s1', 1)]
    const fetchMock = vi.mocked(globalThis.$fetch)

    sync.registerFetchedScenes(original)
    sync.stagePendingReorder(reordered)

    expect(sync.hasPendingReorder.value).toBe(true)

    const flushed = await sync.flushPendingReorder()

    expect(flushed).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/scenes/reorder', {
      method: 'POST',
      body: {
        projectId: projectId.value,
        scenes: reordered.map(scene => ({
          id: scene.id,
          order_index: scene.order_index,
          start_time: scene.start_time,
          end_time: scene.end_time,
          duration: scene.duration,
        })),
      },
    })
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/audio/combine', {
      method: 'POST',
      body: { projectId: projectId.value },
    })
    expect(sync.hasPendingReorder.value).toBe(false)
  })

  it('clears the pending state when the user returns to the original order', async () => {
    const projectId = ref(nextProjectId())
    const sync = useSceneOrderSync(projectId)
    const original = [makeScene('s1', 0), makeScene('s2', 1)]
    const reordered = [makeScene('s2', 0), makeScene('s1', 1)]
    const fetchMock = vi.mocked(globalThis.$fetch)

    sync.registerFetchedScenes(original)
    sync.stagePendingReorder(reordered)
    sync.stagePendingReorder(original)

    expect(sync.hasPendingReorder.value).toBe(false)

    const flushed = await sync.flushPendingReorder()

    expect(flushed).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('still persists the reorder when audio recombine is skipped because scene clips are missing', async () => {
    const projectId = ref(nextProjectId())
    const sync = useSceneOrderSync(projectId)
    const original = [makeScene('s1', 0), makeScene('s2', 1)]
    const reordered = [makeScene('s2', 0), makeScene('s1', 1)]
    const fetchMock = vi.fn(async (url: string) => {
      if (url === '/api/audio/combine') {
        throw { statusCode: 422, message: 'Missing audio for 1 scene(s).' }
      }
      return { ok: true }
    })

    vi.stubGlobal('$fetch', fetchMock)

    sync.registerFetchedScenes(original)
    sync.stagePendingReorder(reordered)

    const flushed = await sync.flushPendingReorder()

    expect(flushed).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(sync.hasPendingReorder.value).toBe(false)
  })
})
