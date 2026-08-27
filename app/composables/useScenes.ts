import type { DbScene } from '~/types/database.types'

export function useScenes(projectId: MaybeRef<string>) {
  const scenes = ref<DbScene[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const sceneOrderSync = useSceneOrderSync(projectId)

  async function fetchScenes() {
    loading.value = true
    error.value = null
    try {
      scenes.value = await globalThis.$fetch<DbScene[]>('/api/scenes', {
        query: { projectId: toValue(projectId) },
      })
      sceneOrderSync.registerFetchedScenes(scenes.value)
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load scenes'
    } finally {
      loading.value = false
    }
  }

  // Recalculate start_time / end_time for all scenes based on current order and durations
  function recalcTimestamps(list: DbScene[]): DbScene[] {
    let cursor = 0
    return list.map((s, i) => {
      const duration = s.duration ?? 5
      const start = cursor
      const end = cursor + duration
      cursor = end
      return { ...s, order_index: i, start_time: start, end_time: end, duration }
    })
  }

  async function updateScene(id: string, patch: Partial<Pick<DbScene, 'script_text' | 'title' | 'duration'>>) {
    // Optimistic local update
    const idx = scenes.value.findIndex(s => s.id === id)
    if (idx === -1) return
    scenes.value[idx] = { ...scenes.value[idx]!, ...patch }

    // If duration changed, recalc all timestamps locally and persist them
    if ('duration' in patch) {
      const recalced = recalcTimestamps([...scenes.value])
      scenes.value = recalced
      if (sceneOrderSync.hasPendingReorder.value) {
        sceneOrderSync.stagePendingReorder(recalced)
        await sceneOrderSync.flushPendingReorder()
        return
      }
      await persistTimestamps(recalced)
      return
    }

    // Otherwise just patch the single scene
    await globalThis.$fetch(`/api/scenes/${id}`, { method: 'PATCH', body: patch })
  }

  async function moveScene(id: string, direction: 'up' | 'down') {
    const idx = scenes.value.findIndex(s => s.id === id)
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= scenes.value.length) return

    const list = [...scenes.value]
    ;[list[idx], list[swapIdx]] = [list[swapIdx]!, list[idx]!]

    const recalced = recalcTimestamps(list)
    scenes.value = recalced
    sceneOrderSync.stagePendingReorder(recalced)
  }

  async function deleteScene(id: string) {
    const idx = scenes.value.findIndex(s => s.id === id)
    if (idx === -1) return

    await globalThis.$fetch(`/api/scenes/${id}`, { method: 'DELETE' })

    const remaining = scenes.value.filter(s => s.id !== id)
    const recalced = recalcTimestamps(remaining)
    scenes.value = recalced
    if (!recalced.length) {
      sceneOrderSync.markPersistedScenes([])
      return
    }
    if (sceneOrderSync.hasPendingReorder.value) {
      sceneOrderSync.stagePendingReorder(recalced)
      await sceneOrderSync.flushPendingReorder()
      return
    }
    await persistTimestamps(recalced)
  }

  async function createScene() {
    const created = await globalThis.$fetch<DbScene>('/api/scenes', {
      method: 'POST',
      body: { projectId: toValue(projectId) },
    })

    const appended = [...scenes.value, created]
    const recalced = recalcTimestamps(appended)
    scenes.value = recalced
    if (sceneOrderSync.hasPendingReorder.value) {
      sceneOrderSync.stagePendingReorder(recalced)
      await sceneOrderSync.flushPendingReorder()
      return created
    }
    await persistTimestamps(recalced)
    return created
  }

  async function persistTimestamps(list: DbScene[]) {
    await globalThis.$fetch('/api/scenes/reorder', {
      method: 'POST',
      body: {
        projectId: toValue(projectId),
        scenes: list.map(s => ({
          id: s.id,
          order_index: s.order_index,
          start_time: s.start_time ?? 0,
          end_time: s.end_time ?? 0,
          duration: s.duration ?? 5,
        })),
      },
    })
    sceneOrderSync.markPersistedScenes(list)
  }

  const totalDuration = computed(() =>
    scenes.value.reduce((sum, s) => sum + (s.duration ?? 0), 0),
  )

  return { scenes, loading, error, fetchScenes, updateScene, moveScene, deleteScene, createScene, totalDuration, recalcTimestamps, persistTimestamps }
}
