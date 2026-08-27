import type { DbScene } from '~/types/database.types'

export interface ScenePrompt {
  sceneId: string
  outputId: string
  prompt: string
}

export function useImageStage(projectId: MaybeRef<string>) {
  // Map of sceneId → { outputId, prompt }
  const prompts = ref<Map<string, ScenePrompt>>(new Map())
  // Map of sceneId → image URL
  const images = ref<Map<string, string>>(new Map())
  // Map of sceneId → durable private-storage path used by queued jobs
  const imagePaths = ref<Map<string, string>>(new Map())
  // Map of sceneId → prompt that was used when the image was generated
  const generationPrompts = ref<Map<string, string>>(new Map())
  const loading = ref(false)

  async function fetchPrompts() {
    loading.value = true
    try {
      const data = await globalThis.$fetch<ScenePrompt[]>('/api/image-prompts', {
        query: { projectId: toValue(projectId) },
      })
      prompts.value = new Map(data.map(p => [p.sceneId, p]))
    } finally {
      loading.value = false
    }
  }

  async function fetchImages() {
    const data = await globalThis.$fetch<{ sceneId: string; url: string; storage_path: string; generationPrompt: string }[]>('/api/images', {
      query: { projectId: toValue(projectId) },
    })
    images.value = new Map(data.map(i => [i.sceneId, i.url]))
    imagePaths.value = new Map(data.filter(i => i.storage_path).map(i => [i.sceneId, i.storage_path]))
    generationPrompts.value = new Map(
      data.filter(i => i.generationPrompt).map(i => [i.sceneId, i.generationPrompt]),
    )
  }

  function setPromptsFromJob(outputs: { sceneId: string; outputId: string; prompt: string }[]) {
    prompts.value = new Map(outputs.map(p => [p.sceneId, p]))
  }

  async function savePrompt(sceneId: string, newText: string) {
    const entry = prompts.value.get(sceneId)
    if (!entry) return
    // Optimistic update so the watcher sees the new value immediately
    prompts.value.set(sceneId, { ...entry, prompt: newText })
    await globalThis.$fetch(`/api/image-prompts/${entry.outputId}`, {
      method: 'PATCH',
      body: { prompt: newText },
    })
  }

  function getPrompt(scene: DbScene): string {
    return prompts.value.get(scene.id)?.prompt ?? ''
  }

  function hasPrompt(scene: DbScene): boolean {
    return prompts.value.has(scene.id) && !!prompts.value.get(scene.id)?.prompt
  }

  function getImage(scene: DbScene): string | null {
    return images.value.get(scene.id) ?? null
  }

  function getImagePath(scene: DbScene): string | null {
    return imagePaths.value.get(scene.id) ?? null
  }

  function getGenerationPrompt(scene: DbScene): string {
    return generationPrompts.value.get(scene.id) ?? ''
  }

  return {
    prompts, images, imagePaths, generationPrompts, loading,
    fetchPrompts, fetchImages, setPromptsFromJob, savePrompt,
    getPrompt, hasPrompt, getImage, getImagePath, getGenerationPrompt,
  }
}
