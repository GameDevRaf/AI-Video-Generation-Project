import { defineStore } from 'pinia'
import type { DbProject, DbProjectSettings } from '~/types/database.types'

export const useProjectStore = defineStore('project', () => {
  const currentProject = ref<DbProject | null>(null)
  const settings = ref<DbProjectSettings | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  const currentStage = computed(() => currentProject.value?.current_stage ?? 'script')
  const projectId = computed(() => currentProject.value?.id ?? null)

  async function loadProject(id: string) {
    loading.value = true
    error.value = null
    try {
      const data = await globalThis.$fetch<DbProject & { project_settings: DbProjectSettings | null }>(
        `/api/projects/${id}`,
      )
      currentProject.value = data
      settings.value = data.project_settings ?? null
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load project'
    } finally {
      loading.value = false
    }
  }

  async function setStage(stage: string) {
    if (!currentProject.value) return
    currentProject.value.current_stage = stage
    await globalThis.$fetch(`/api/projects/${currentProject.value.id}`, {
      method: 'PATCH',
      body: { current_stage: stage },
    })
  }

  async function updateSettings(partial: Partial<DbProjectSettings>) {
    if (!currentProject.value) return
    const previous = settings.value ? { ...settings.value } : null
    if (settings.value) Object.assign(settings.value, partial)
    try {
      await globalThis.$fetch(`/api/projects/${currentProject.value.id}/settings`, {
        method: 'PATCH',
        body: partial,
      })
    } catch (e) {
      // Roll back the optimistic update so the UI doesn't drift out of sync with the
      // database when the write fails (e.g. a column the client expects doesn't exist yet).
      if (settings.value && previous) Object.assign(settings.value, previous)
      throw e
    }
  }

  function reset() {
    currentProject.value = null
    settings.value = null
    loading.value = false
    error.value = null
  }

  return {
    currentProject,
    settings,
    currentStage,
    projectId,
    loading,
    error,
    loadProject,
    setStage,
    updateSettings,
    reset,
  }
})
