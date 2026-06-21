<template>
  <section class="flex flex-col gap-8 px-8 py-10 max-w-5xl mx-auto w-full">
    <!-- Header -->
    <div class="flex flex-col gap-1">
      <h2 class="text-lg font-semibold">Scenes</h2>
      <p class="text-sm text-gray-500">Split your script into scenes with estimated durations.</p>
    </div>

    <!-- Script preview (locked) -->
    <div class="p-4 rounded-xl border border-white/8 bg-white/2">
      <p class="text-xs text-gray-500 mb-2 font-medium uppercase tracking-wider">Active script</p>
      <p class="text-sm text-gray-400 leading-relaxed whitespace-pre-wrap line-clamp-4">{{ scriptText }}</p>
    </div>

    <!-- Generate button -->
    <div class="flex items-center gap-4">
      <button
        :disabled="isRunning || scenesLoading"
        class="px-5 py-2 bg-white text-gray-950 rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors disabled:opacity-40"
        @click="splitScenes"
      >
        <span v-if="isRunning" class="flex items-center gap-2">
          <span class="inline-block w-3.5 h-3.5 border-2 border-gray-400 border-t-gray-800 rounded-full animate-spin" />
          Splitting…
        </span>
        <span v-else-if="scenes.length">Re-split scenes</span>
        <span v-else>Split into scenes</span>
      </button>

      <span v-if="scenes.length" class="text-sm text-gray-500">
        {{ scenes.length }} scenes · {{ formatTime(totalDuration) }} total
      </span>

      <p v-if="isFailed" class="text-sm text-red-400">
        {{ pollerError ?? job?.error_message ?? 'Scene split failed.' }}
      </p>
    </div>

    <!-- Scene cards -->
    <div v-if="scenesLoading" class="text-sm text-gray-500">Loading scenes…</div>
    <div v-else-if="scenes.length" class="flex flex-col gap-3">
      <StagesSceneCard
        v-for="(scene, i) in scenes"
        :key="scene.id"
        :scene="scene"
        :is-first="i === 0"
        :is-last="i === scenes.length - 1"
        @update="updateScene"
        @move="moveScene"
      />

      <!-- Advance button -->
      <div class="pt-2">
        <button
          class="px-5 py-2 bg-white text-gray-950 rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors"
          @click="$emit('done')"
        >
          Continue to Images →
        </button>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
const props = defineProps<{ projectId: string; scriptText: string }>()
defineEmits<{ done: [] }>()

const { job, isRunning, isFailed, error: pollerError, startJob } = useJobPoller()
const { scenes, loading: scenesLoading, totalDuration, fetchScenes, updateScene, moveScene } = useScenes(toRef(props, 'projectId'))

// Load existing scenes on mount (if a previous split was done)
onMounted(fetchScenes)

// Refresh scene list when the split job completes
watch(job, async (j) => {
  if (j?.status === 'completed') await fetchScenes()
})

async function splitScenes() {
  await startJob(props.projectId, 'scene_split', { script_text: props.scriptText })
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}
</script>
