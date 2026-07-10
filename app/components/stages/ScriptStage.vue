<template>
  <section class="flex flex-col gap-8 px-8 py-10 max-w-5xl mx-auto w-full">
    <!-- Header -->
    <div class="flex flex-col gap-1">
      <h2 class="text-lg font-semibold">Script</h2>
      <p class="text-sm text-gray-500">Describe your video idea and we'll generate scripts for you to choose from.</p>
    </div>

    <!-- LOCKED STATE: script committed, show read-only summary -->
    <template v-if="isLocked">
      <div class="flex flex-col gap-3 p-5 rounded-xl border border-white/10 bg-white/3">
        <div class="flex items-center justify-between">
          <span class="text-sm text-gray-300">Video idea</span>
          <span class="text-xs text-green-400/80 bg-green-400/10 px-2 py-0.5 rounded-full font-medium">Script finalized</span>
        </div>
        <p class="text-sm text-gray-500 leading-relaxed">{{ idea || '—' }}</p>
      </div>

      <div class="flex flex-col gap-3 p-5 rounded-xl border border-white/15 bg-white/3">
        <div class="flex items-center justify-between">
          <span class="text-sm text-gray-300">Finalized script</span>
          <span class="text-xs text-gray-600">{{ finalizedWordCount }} words</span>
        </div>
        <p class="text-sm text-gray-400 leading-relaxed whitespace-pre-wrap font-mono text-xs">{{ workspace.activeScriptText ?? '…' }}</p>
      </div>
    </template>

    <!-- NORMAL STATE: generate, pick, edit -->
    <template v-else>
      <!-- Input form -->
      <div class="flex flex-col gap-4 p-5 rounded-xl border border-white/10 bg-white/3">
        <div class="flex flex-col gap-1.5">
          <label class="text-sm text-gray-300" for="idea">Video idea</label>
          <textarea
            id="idea"
            v-model="idea"
            rows="4"
            placeholder="e.g. A 60-second explainer about how black holes form, aimed at curious high-schoolers"
            :disabled="isRunning"
            class="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-white/20 resize-none disabled:opacity-50"
          />
        </div>

        <div class="flex items-end gap-4 flex-wrap">
          <div class="flex flex-col gap-1.5 w-48">
            <label class="text-sm text-gray-300" for="tone">Tone</label>
            <select
              id="tone"
              v-model="tone"
              :disabled="isRunning"
              class="w-full px-3 py-2 bg-gray-800 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-1 focus:ring-white/20 disabled:opacity-50"
            >
              <option v-for="t in tones" :key="t" :value="t">{{ t }}</option>
            </select>
          </div>

          <div class="flex flex-col gap-1.5">
            <label class="text-sm text-gray-300">Target length</label>
            <div class="flex gap-1 p-1 bg-white/5 rounded-lg w-fit">
              <button
                v-for="preset in lengthPresets"
                :key="preset.seconds"
                type="button"
                :disabled="isRunning"
                class="px-3 py-1.5 rounded-md text-xs font-medium transition-colors disabled:opacity-50"
                :class="targetDuration === preset.seconds
                  ? 'bg-white text-gray-950'
                  : 'text-gray-400 hover:text-white'"
                @click="setTargetDuration(preset.seconds)"
              >
                {{ preset.label }}
              </button>
            </div>
          </div>

          <button
            :disabled="!idea.trim() || isRunning"
            class="px-5 py-2 bg-white text-gray-950 rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors disabled:opacity-40"
            @click="generate"
          >
            <span v-if="isRunning" class="flex items-center gap-2">
              <span class="inline-block w-3.5 h-3.5 border-2 border-gray-400 border-t-gray-800 rounded-full animate-spin" />
              Generating…
            </span>
            <span v-else>Generate scripts</span>
          </button>
        </div>

        <p v-if="targetDurationError" class="text-sm text-amber-400/80">{{ targetDurationError }}</p>
      </div>

      <!-- Script candidates -->
      <div v-if="candidates.length" class="flex flex-col gap-4">
        <p class="text-sm text-gray-400">Choose a script to work with:</p>
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <button
            v-for="(script, i) in candidates"
            :key="script.id"
            class="text-left flex flex-col gap-3 p-4 rounded-xl border transition-all"
            :class="selectedId === script.id
              ? 'border-white/40 bg-white/8'
              : 'border-white/10 bg-white/3 hover:border-white/20 hover:bg-white/5'"
            @click="select(script)"
          >
            <div class="flex items-center justify-between">
              <span class="text-xs font-medium text-gray-400">Option {{ i + 1 }}</span>
              <span
                class="text-xs"
                :class="estimateSpokenSeconds(countWords(scriptText(script))) > targetDuration ? 'text-amber-400/80' : 'text-gray-600'"
              >
                ~{{ Math.round(estimateSpokenSeconds(countWords(scriptText(script)))) }}s · ~{{ countWords(scriptText(script)) }}w
              </span>
            </div>
            <p class="text-sm text-gray-200 leading-relaxed line-clamp-6 whitespace-pre-wrap">{{ scriptText(script) }}</p>
            <span v-if="selectedId === script.id" class="text-xs text-white/60 font-medium">Selected</span>
          </button>
        </div>
      </div>

      <!-- Script editor — shown after selection -->
      <StagesScriptEditor
        v-if="selectedScript"
        :key="selectedScript.id"
        :project-id="projectId"
        :initial-text="scriptText(selectedScript)"
        :output-id="selectedScript.id"
        @use="onUse"
        @regenerate="onRegenerate"
      />
    </template>
  </section>
</template>

<script setup lang="ts">
import type { DbJobOutput } from '~/types/database.types'
import { VIDEO_FORMAT } from '../../../shared/config/videoFormat'
import { countWords, estimateSpokenSeconds } from '../../../shared/utils/scriptLength'

const props = defineProps<{ projectId: string }>()
const emit = defineEmits<{ done: [] }>()

const projectStore = useProjectStore()
const workspace = useWorkspaceStore()

const tones = ['Educational', 'Narrative', 'Promotional', 'Conversational', 'Documentary', 'Inspirational']
const lengthPresets = [
  { seconds: 15, label: '15s' },
  { seconds: 30, label: '30s' },
  { seconds: 60, label: '60s' },
  { seconds: 90, label: '90s' },
  { seconds: VIDEO_FORMAT.maxDuration, label: '3m' },
]

const idea = ref('')
const tone = ref('Educational')
const selectedId = ref<string | null>(null)
const selectedScript = ref<DbJobOutput | null>(null)
const targetDurationError = ref<string | undefined>(undefined)

const targetDuration = computed(() =>
  Math.min(projectStore.settings?.target_duration_seconds ?? 30, VIDEO_FORMAT.maxDuration),
)

async function setTargetDuration(seconds: number) {
  targetDurationError.value = undefined
  try {
    await projectStore.updateSettings({ target_duration_seconds: Math.min(seconds, VIDEO_FORMAT.maxDuration) })
  } catch {
    targetDurationError.value = 'Failed to save target length — please try again.'
  }
}

const { job, isRunning, startJob, retryJob } = useJobPoller()
const notifications = useNotificationsStore()

watch(job, (j) => {
  if (j?.status === 'failed') {
    notifications.notifyJobError({
      key: 'script',
      errorMessage: j.error_message ?? 'Script generation failed.',
      onRetry: retry,
    })
  } else if (j?.status === 'completed') {
    notifications.dismiss('script')
  }
})

const isLocked = computed(() => projectStore.currentStage !== 'script')
const finalizedWordCount = computed(() =>
  (workspace.activeScriptText ?? '').trim().split(/\s+/).filter(Boolean).length,
)

const candidates = computed<DbJobOutput[]>(() => {
  if (!job.value?.job_outputs) return []
  return job.value.job_outputs
    .filter(o => o.label?.startsWith('script_candidate_'))
    .sort((a, b) => (a.label ?? '').localeCompare(b.label ?? ''))
})

// Restore idea + tone from DB when returning to a locked project
onMounted(async () => {
  if (!isLocked.value) return
  try {
    const data = await $fetch<{ text: string | null; idea: string | null; tone: string | null }>(
      '/api/script',
      { query: { projectId: props.projectId } },
    )
    if (data.idea) idea.value = data.idea
    if (data.tone) tone.value = data.tone
  } catch {}
})

function scriptText(output: DbJobOutput): string {
  return (output.metadata as { content?: string } | null)?.content ?? ''
}

async function generate() {
  selectedId.value = null
  selectedScript.value = null
  const provider = projectStore.settings?.default_script_provider ?? undefined
  const model = (projectStore.settings as Record<string, unknown> | null)?.default_script_model as string | undefined
  await startJob(props.projectId, 'script', {
    idea: idea.value.trim(),
    tone: tone.value,
    target_duration_seconds: targetDuration.value,
    ...(provider ? { provider } : {}),
    ...(model ? { model } : {}),
  })
}

async function retry() {
  if (!job.value) return
  await retryJob(job.value.id)
}

function onRegenerate() {
  selectedId.value = null
  selectedScript.value = null
  generate()
}

function select(script: DbJobOutput) {
  selectedId.value = script.id
  selectedScript.value = script
}

function onUse(_text: string) {
  // Emit done so [projectId].vue can call projectStore.setStage('scene_split'),
  // which updates both Pinia and the DB, making showSceneSplit reactive.
  emit('done')
}
</script>
