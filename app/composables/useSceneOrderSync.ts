import type { DbScene } from '~/types/database.types'

type PersistedSceneSnapshot = Pick<DbScene, 'id' | 'order_index' | 'start_time' | 'end_time' | 'duration'>

function getSceneOrderSignature(list: Pick<DbScene, 'id'>[]) {
  return list.map(scene => scene.id).join('|')
}

function toPersistedSceneSnapshot(list: DbScene[]): PersistedSceneSnapshot[] {
  return list.map(scene => ({
    id: scene.id,
    order_index: scene.order_index,
    start_time: scene.start_time ?? 0,
    end_time: scene.end_time ?? 0,
    duration: scene.duration ?? 5,
  }))
}

function isMissingSceneAudioError(error: unknown) {
  if (!error || typeof error !== 'object') return false

  const statusCode = 'statusCode' in error ? error.statusCode : null
  const statusMessage = 'statusMessage' in error ? error.statusMessage : null
  const message = 'message' in error ? error.message : null
  const text = [statusMessage, message].filter(value => typeof value === 'string').join(' ')

  return statusCode === 422 && text.toLowerCase().includes('missing audio')
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export function useSceneOrderSync(projectId: MaybeRef<string>) {
  const projectKey = toValue(projectId)
  const savedOrderSignature = useState<string>(`scene-order-sync:${projectKey}:saved-order`, () => '')
  const pendingOrderSignature = useState<string | null>(`scene-order-sync:${projectKey}:pending-order`, () => null)
  const pendingScenes = useState<PersistedSceneSnapshot[] | null>(`scene-order-sync:${projectKey}:pending-scenes`, () => null)
  const flushing = useState<boolean>(`scene-order-sync:${projectKey}:flushing`, () => false)

  const hasPendingReorder = computed(() =>
    !!pendingScenes.value
    && !!pendingOrderSignature.value
    && pendingOrderSignature.value !== savedOrderSignature.value,
  )

  function markPersistedScenes(list: Pick<DbScene, 'id'>[]) {
    savedOrderSignature.value = getSceneOrderSignature(list)
    pendingOrderSignature.value = null
    pendingScenes.value = null
  }

  function registerFetchedScenes(list: DbScene[]) {
    if (hasPendingReorder.value) return
    markPersistedScenes(list)
  }

  function stagePendingReorder(list: DbScene[]) {
    const signature = getSceneOrderSignature(list)

    if (!savedOrderSignature.value) {
      savedOrderSignature.value = signature
    }

    if (signature === savedOrderSignature.value) {
      pendingOrderSignature.value = null
      pendingScenes.value = null
      return
    }

    pendingOrderSignature.value = signature
    pendingScenes.value = toPersistedSceneSnapshot(list)
  }

  async function flushPendingReorder() {
    if (flushing.value) {
      while (flushing.value) {
        await delay(25)
      }
      return false
    }

    if (!hasPendingReorder.value || !pendingScenes.value) return false

    flushing.value = true
    try {
      const currentPendingScenes = pendingScenes.value
      await $fetch('/api/scenes/reorder', {
        method: 'POST',
        body: {
          projectId: toValue(projectId),
          scenes: currentPendingScenes,
        },
      })

      try {
        await $fetch('/api/audio/combine', {
          method: 'POST',
          body: { projectId: toValue(projectId) },
        })
      } catch (error) {
        if (!isMissingSceneAudioError(error)) throw error
      }

      markPersistedScenes(currentPendingScenes)
      return true
    } finally {
      flushing.value = false
    }
  }

  return {
    flushing,
    hasPendingReorder,
    registerFetchedScenes,
    markPersistedScenes,
    stagePendingReorder,
    flushPendingReorder,
  }
}
