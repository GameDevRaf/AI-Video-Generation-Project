<template>
  <div class="flex flex-col gap-4 p-5 rounded-xl border border-white/15 bg-white/3">
    <div class="flex items-center justify-between">
      <h3 class="text-sm font-medium text-gray-200">Edit script</h3>
      <span class="text-xs text-gray-500">{{ wordCount }} words</span>
    </div>

    <textarea
      v-model="text"
      rows="12"
      class="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm text-gray-100 leading-relaxed focus:outline-none focus:ring-1 focus:ring-white/20 resize-none font-mono"
    />

    <!-- Refine section -->
    <div v-if="showRefine" class="flex flex-col gap-2">
      <textarea
        v-model="refineInstructions"
        rows="2"
        placeholder="e.g. Make it shorter, add a hook in the first sentence, more casual tone"
        class="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-white/20 resize-none"
      />
      <div class="flex gap-2">
        <button
          :disabled="!refineInstructions.trim() || isRunning"
          class="px-4 py-1.5 bg-white/10 text-white rounded-lg text-sm hover:bg-white/15 transition-colors disabled:opacity-40"
          @click="refine"
        >
          <span v-if="isRunning" class="flex items-center gap-1.5">
            <span class="inline-block w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
            Refining…
          </span>
          <span v-else>Refine</span>
        </button>
        <button
          class="px-4 py-1.5 text-gray-400 hover:text-white text-sm transition-colors"
          @click="showRefine = false"
        >
          Cancel
        </button>
      </div>
      <p v-if="pollerError" class="text-sm text-red-400">{{ pollerError }}</p>
    </div>

    <!-- Actions -->
    <div class="flex items-center gap-3 pt-1">
      <button
        class="px-4 py-2 bg-white text-gray-950 rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors"
        @click="useScript"
      >
        Use this script →
      </button>
      <button
        v-if="!showRefine"
        class="px-4 py-2 border border-white/10 text-gray-300 rounded-lg text-sm hover:bg-white/5 transition-colors"
        @click="showRefine = true"
      >
        Refine with AI
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  projectId: string
  initialText: string
  outputId: string
}>()

const emit = defineEmits<{ use: [text: string] }>()

const workspace = useWorkspaceStore()
const router = useRouter()

const text = ref(props.initialText)
const showRefine = ref(false)
const refineInstructions = ref('')

const { job, isRunning, error: pollerError, startJob } = useJobPoller()

const wordCount = computed(() => text.value.trim().split(/\s+/).filter(Boolean).length)

// When a refinement job finishes, replace the text with the refined version
watch(job, (j) => {
  if (j?.status !== 'completed') return
  const refined = j.job_outputs?.find(o => o.label === 'script_refined')
  if (refined) {
    const content = (refined.metadata as { content?: string } | null)?.content
    if (content) {
      text.value = content
      showRefine.value = false
      refineInstructions.value = ''
    }
  }
})

async function refine() {
  await startJob(props.projectId, 'script', {
    existing_script: text.value,
    refinement_instructions: refineInstructions.value.trim(),
    tone: '',
    idea: '',
  })
}

async function useScript() {
  workspace.setActiveScript(text.value, props.outputId)
  // Advance project stage to scene_split
  await $fetch(`/api/projects/${props.projectId}`, {
    method: 'PATCH',
    body: { current_stage: 'scene_split' },
  })
  emit('use', text.value)
}
</script>
