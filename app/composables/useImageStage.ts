import type { DbScene } from '~/types/database.types'

export interface ScenePrompt {
  sceneId: string
  outputId: string
  prompt: string
}

export function useImageStage(projectId: MaybeRef<string>) {
  // Map of sceneId → { outputId, prompt }
  const prompts = ref<Map<string, ScenePrompt>>(new Map())
  // Map of sceneId → image URL (populated when an image job completes)
  const images = ref<Map<string, string>>(new Map())
  const loading = ref(false)

  async function fetchPrompts() {
    loading.value = true
    try {
      const data = await $fetch<ScenePrompt[]>('/api/image-prompts', {
        query: { projectId: toValue(projectId) },
      })
      prompts.value = new Map(data.map(p => [p.sceneId, p]))
    } finally {
      loading.value = false
    }
  }

  function setPromptsFromJob(outputs: { sceneId: string; outputId: string; prompt: string }[]) {
    prompts.value = new Map(outputs.map(p => [p.sceneId, p]))
  }

  async function savePrompt(sceneId: string, newText: string) {
    const entry = prompts.value.get(sceneId)
    if (!entry) return
    // Optimistic
    prompts.value.set(sceneId, { ...entry, prompt: newText })
    await $fetch(`/api/image-prompts/${entry.outputId}`, {
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

  return { prompts, images, loading, fetchPrompts, setPromptsFromJob, savePrompt, getPrompt, hasPrompt, getImage }
}
