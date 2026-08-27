<template>
  <div
    class="group relative flex flex-col gap-3 p-4 rounded-xl border border-white/10 bg-white/3 hover:bg-white/5 hover:border-white/20 transition-all cursor-pointer"
    @click="router.push(`/workspace/${project.id}`)"
  >
    <!-- Stage badge -->
    <span class="self-start text-xs px-2 py-0.5 rounded-full bg-white/8 text-gray-400 capitalize">
      {{ project.current_stage }}
    </span>

    <div class="flex flex-col gap-1">
      <h3 class="text-sm font-medium text-white leading-snug">{{ project.name }}</h3>
      <p v-if="project.description" class="text-xs text-gray-500 line-clamp-2">{{ project.description }}</p>
    </div>

    <p class="text-xs text-gray-600 mt-auto">{{ relativeTime }}</p>

    <!-- Delete button -->
    <button
      class="absolute top-3 right-3 opacity-0 group-hover:opacity-100 p-1 rounded text-gray-500 hover:text-red-400 hover:bg-white/5 transition-all"
      title="Delete project"
      @click.stop="$emit('delete', project.id)"
    >
      <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>
      </svg>
    </button>
  </div>
</template>

<script setup lang="ts">
import type { ProjectWithSettings } from '~/composables/useProjects'

const props = defineProps<{ project: ProjectWithSettings }>()
defineEmits<{ delete: [id: string] }>()
const router = useRouter()

const relativeTime = computed(() => {
  const diff = Date.now() - new Date(props.project.updated_at).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
})
</script>
