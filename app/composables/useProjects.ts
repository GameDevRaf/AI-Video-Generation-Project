import type { DbProject } from '~/types/database.types'

export type ProjectWithSettings = DbProject & {
  project_settings: { prompt_edit_mode: string } | null
}

export function useProjects() {
  const projects = ref<ProjectWithSettings[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchProjects() {
    loading.value = true
    error.value = null
    try {
      projects.value = await $fetch<ProjectWithSettings[]>('/api/projects')
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : 'Failed to load projects'
    } finally {
      loading.value = false
    }
  }

  async function createProject(name: string, description?: string): Promise<DbProject> {
    const project = await $fetch<DbProject>('/api/projects', {
      method: 'POST',
      body: { name, description },
    })
    await fetchProjects()
    return project
  }

  async function deleteProject(id: string) {
    await $fetch(`/api/projects/${id}`, { method: 'DELETE' })
    projects.value = projects.value.filter(p => p.id !== id)
  }

  return { projects, loading, error, fetchProjects, createProject, deleteProject }
}
