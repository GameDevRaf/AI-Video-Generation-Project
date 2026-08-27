export interface SceneVideoPrompt {
  sceneId: string
  outputId: string
  prompt: string
}

export function useVideoStage(projectId: MaybeRef<string>) {
  const prompts = ref<Map<string, SceneVideoPrompt>>(new Map())
  const videos = ref<Map<string, string>>(new Map())
  const generationPrompts = ref<Map<string, string>>(new Map())
  const loading = ref(false)

  async function fetchPrompts() {
    loading.value = true
    try {
      const data = await globalThis.$fetch<SceneVideoPrompt[]>('/api/video-prompts', {
        query: { projectId: toValue(projectId) },
      })
      prompts.value = new Map(data.map(p => [p.sceneId, p]))
    } finally {
      loading.value = false
    }
  }

  async function fetchVideos() {
    const data = await globalThis.$fetch<{ sceneId: string; url: string; generationPrompt: string }[]>('/api/videos', {
      query: { projectId: toValue(projectId) },
    })
    videos.value = new Map(data.map(v => [v.sceneId, v.url]))
    generationPrompts.value = new Map(
      data.filter(v => v.generationPrompt).map(v => [v.sceneId, v.generationPrompt]),
    )
  }

  async function savePrompt(sceneId: string, newText: string) {
    const entry = prompts.value.get(sceneId)
    if (!entry) return
    prompts.value.set(sceneId, { ...entry, prompt: newText })
    await globalThis.$fetch(`/api/video-prompts/${entry.outputId}`, {
      method: 'PATCH',
      body: { prompt: newText },
    })
  }

  function getPrompt(sceneId: string): string {
    return prompts.value.get(sceneId)?.prompt ?? ''
  }

  function getVideo(sceneId: string): string | null {
    return videos.value.get(sceneId) ?? null
  }

  function getGenerationPrompt(sceneId: string): string {
    return generationPrompts.value.get(sceneId) ?? ''
  }

  function hasPrompt(sceneId: string): boolean {
    return prompts.value.has(sceneId) && !!prompts.value.get(sceneId)?.prompt
  }

  const hasAnyVideo = computed(() => videos.value.size > 0)
  const hasAnyPrompt = computed(() => prompts.value.size > 0)

  return {
    prompts,
    videos,
    generationPrompts,
    loading,
    fetchPrompts,
    fetchVideos,
    savePrompt,
    getPrompt,
    getVideo,
    getGenerationPrompt,
    hasPrompt,
    hasAnyVideo,
    hasAnyPrompt,
  }
}
