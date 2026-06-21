<template>
  <div class="p-8 flex flex-col gap-6">
    <div class="flex items-center justify-between">
      <h1 class="text-xl font-semibold">Projects</h1>
      <button
        class="px-4 py-2 bg-white text-gray-950 rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors"
        @click="showCreate = true"
      >
        New project
      </button>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="text-sm text-gray-500">Loading projects…</div>

    <!-- Error -->
    <p v-else-if="error" class="text-sm text-red-400">{{ error }}</p>

    <!-- Empty state -->
    <div
      v-else-if="projects.length === 0"
      class="flex flex-col items-center justify-center gap-4 py-24 text-center"
    >
      <p class="text-gray-500 text-sm">No projects yet.</p>
      <button
        class="px-4 py-2 border border-white/10 rounded-lg text-sm text-gray-300 hover:bg-white/5 transition-colors"
        @click="showCreate = true"
      >
        Create your first project
      </button>
    </div>

    <!-- Project grid -->
    <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
      <ProjectCard
        v-for="project in projects"
        :key="project.id"
        :project="project"
        @delete="handleDelete"
      />
    </div>

    <CreateProjectModal
      v-if="showCreate"
      @close="showCreate = false"
      @created="onCreated"
    />
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'dashboard', middleware: 'auth' })

const router = useRouter()
const { projects, loading, error, fetchProjects, deleteProject } = useProjects()
const showCreate = ref(false)

await fetchProjects()

async function handleDelete(id: string) {
  if (!confirm('Delete this project? This cannot be undone.')) return
  await deleteProject(id)
}

function onCreated(projectId: string) {
  showCreate.value = false
  router.push(`/workspace/${projectId}`)
}
</script>
