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

    <!-- Script Length Guard — soft warning when the estimated spoken duration exceeds the chosen target -->
    <div
      v-if="overTarget"
      data-testid="script-length-warning"
      class="flex flex-col gap-2 p-3 rounded-lg border"
      :class="overHardCeiling ? 'border-red-400/30 bg-red-400/5' : 'border-amber-400/30 bg-amber-400/5'"
    >
      <p class="text-sm" :class="overHardCeiling ? 'text-red-400/90' : 'text-amber-400/90'">
        Estimated ~{{ Math.round(estimatedSeconds) }}s at ~130 words/min — exceeds your {{ targetLabel }} target.
        <template v-if="overHardCeiling">
          This is over the 3-minute hard limit — trim the script or regenerate before you can use it.
        </template>
        <template v-else>
          You can trim the script above, or regenerate it.
        </template>
      </p>
      <button
        data-testid="script-length-regenerate"
        class="self-start px-3 py-1.5 border border-white/15 text-gray-200 rounded-lg text-xs font-medium hover:bg-white/5 transition-colors"
        @click="$emit('regenerate')"
      >
        Regenerate
      </button>
    </div>

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
    </div>

    <!-- Actions -->
    <div class="flex items-center gap-3 pt-1">
      <button
        :disabled="overHardCeiling"
        data-testid="use-script-button"
        class="px-4 py-2 bg-white text-gray-950 rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors disabled:opacity-40"
        :title="overHardCeiling ? 'Trim the script below the 3-minute hard limit before continuing' : undefined"
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
import { VIDEO_FORMAT } from '#shared/config/videoFormat'
import { countWords, estimateSpokenSeconds } from '#shared/utils/scriptLength'

const props = defineProps<{
  projectId: string
  initialText: string
  outputId: string
}>()

const emit = defineEmits<{ use: [text: string]; regenerate: [] }>()

const workspace = useWorkspaceStore()
const router = useRouter()
const projectStore = useProjectStore()

const text = ref(props.initialText)
const showRefine = ref(false)
const refineInstructions = ref('')

const { job, isRunning, startJob, retryJob } = useJobPoller()
const notifications = useNotificationsStore()

const wordCount = computed(() => countWords(text.value))

const targetSeconds = computed(() =>
  Math.min(projectStore.settings?.target_duration_seconds ?? 30, VIDEO_FORMAT.maxDuration),
)
// Matches the preset button labels in ScriptStage.vue exactly (15s/30s/60s/90s/3m) —
// only the 3-minute ceiling itself uses the "m" form.
const targetLabel = computed(() => {
  const s = targetSeconds.value
  return s === VIDEO_FORMAT.maxDuration ? `${s / 60}m` : `${s}s`
})
const estimatedSeconds = computed(() => estimateSpokenSeconds(wordCount.value))
const overTarget = computed(() => estimatedSeconds.value > targetSeconds.value)
const overHardCeiling = computed(() => estimatedSeconds.value > VIDEO_FORMAT.maxDuration + 30)

// When a refinement job finishes, replace the text with the refined version
watch(job, (j) => {
  if (j?.status === 'failed') {
    notifications.notifyJobError({
      key: 'script-refine',
      errorMessage: j.error_message ?? 'Refinement failed.',
      onRetry: retryRefine,
    })
    return
  }
  if (j?.status !== 'completed') return
  notifications.dismiss('script-refine')
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
    target_duration_seconds: targetSeconds.value,
    tone: '',
    idea: '',
  })
}

async function retryRefine() {
  if (!job.value) return
  await retryJob(job.value.id)
}

async function useScript() {
  if (overHardCeiling.value) return
  workspace.setActiveScript(text.value, props.outputId)
  // Stage advancement is handled by the parent page via projectStore.setStage,
  // which keeps the Pinia store and DB in sync.
  emit('use', text.value)
}
</script>
