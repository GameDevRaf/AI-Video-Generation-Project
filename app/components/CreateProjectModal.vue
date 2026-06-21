<template>
  <Teleport to="body">
    <div
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      @click.self="$emit('close')"
    >
      <div class="w-full max-w-md bg-gray-900 border border-white/10 rounded-2xl p-6 flex flex-col gap-5 shadow-2xl">
        <div class="flex items-center justify-between">
          <h2 class="text-base font-semibold">New project</h2>
          <button
            class="text-gray-500 hover:text-white transition-colors"
            @click="$emit('close')"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 6 6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <form class="flex flex-col gap-4" @submit.prevent="submit">
          <div class="flex flex-col gap-1.5">
            <label class="text-sm text-gray-300" for="proj-name">Project name</label>
            <input
              id="proj-name"
              ref="nameInput"
              v-model="name"
              type="text"
              required
              maxlength="100"
              placeholder="My video project"
              class="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-white/30"
            />
          </div>

          <div class="flex flex-col gap-1.5">
            <label class="text-sm text-gray-300" for="proj-desc">Description <span class="text-gray-500">(optional)</span></label>
            <textarea
              id="proj-desc"
              v-model="description"
              rows="2"
              placeholder="What's this video about?"
              class="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-white/30 resize-none"
            />
          </div>

          <p v-if="error" class="text-sm text-red-400">{{ error }}</p>

          <div class="flex justify-end gap-3 pt-1">
            <button
              type="button"
              class="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
              @click="$emit('close')"
            >
              Cancel
            </button>
            <button
              type="submit"
              :disabled="loading || !name.trim()"
              class="px-5 py-2 bg-white text-gray-950 rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors disabled:opacity-50"
            >
              {{ loading ? 'Creating…' : 'Create project' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
const emit = defineEmits<{
  close: []
  created: [projectId: string]
}>()

const { createProject } = useProjects()

const name = ref('')
const description = ref('')
const loading = ref(false)
const error = ref('')
const nameInput = ref<HTMLInputElement | null>(null)

onMounted(() => nextTick(() => nameInput.value?.focus()))

async function submit() {
  if (!name.value.trim()) return
  loading.value = true
  error.value = ''
  try {
    const project = await createProject(name.value.trim(), description.value.trim() || undefined)
    emit('created', project.id)
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Something went wrong'
  } finally {
    loading.value = false
  }
}
</script>
