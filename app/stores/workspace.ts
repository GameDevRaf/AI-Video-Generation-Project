import { defineStore } from 'pinia'

export const useWorkspaceStore = defineStore('workspace', () => {
  const projectId = ref<string | null>(null)
  const activeScriptText = ref<string | null>(null)
  const activeScriptOutputId = ref<string | null>(null)

  // Timeline
  const playbackTime = ref(0)
  const isPlaying = ref(false)
  const isTimelineExpanded = ref(false)

  function setProject(id: string) {
    projectId.value = id
  }

  function setActiveScript(text: string, outputId?: string) {
    activeScriptText.value = text
    activeScriptOutputId.value = outputId ?? null
  }

  function clearActiveScript() {
    activeScriptText.value = null
    activeScriptOutputId.value = null
  }

  function reset() {
    activeScriptText.value = null
    activeScriptOutputId.value = null
    playbackTime.value = 0
    isPlaying.value = false
    isTimelineExpanded.value = false
  }

  return {
    projectId,
    activeScriptText,
    activeScriptOutputId,
    playbackTime,
    isPlaying,
    isTimelineExpanded,
    setProject,
    setActiveScript,
    clearActiveScript,
    reset,
  }
})
