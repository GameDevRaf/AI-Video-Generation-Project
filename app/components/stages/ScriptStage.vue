<template>
  <section class="flex flex-col gap-8 px-8 py-10 max-w-5xl mx-auto w-full">
    <!-- Header -->
    <div class="flex flex-col gap-1">
      <h2 class="text-lg font-semibold">Script</h2>
      <p class="text-sm text-gray-500">Describe your video idea and we'll generate scripts for you to choose from.</p>
    </div>

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

      <div class="flex items-end gap-4">
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

      <p v-if="pollerError" class="text-sm text-red-400">{{ pollerError }}</p>
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
          <span class="text-xs font-medium text-gray-400">Option {{ i + 1 }}</span>
          <p class="text-sm text-gray-200 leading-relaxed line-clamp-6 whitespace-pre-wrap">{{ scriptText(script) }}</p>
          <span v-if="selectedId === script.id" class="text-xs text-white/60 font-medium">Selected</span>
        </button>
      </div>
    </div>

    <!-- Script editor — shown after selection -->
    <StagesScriptEditor
      v-if="selectedScript"
      :project-id="projectId"
      :initial-text="scriptText(selectedScript)"
      :output-id="selectedScript.id"
      @use="onUse"
    />
  </section>
</template>

<script setup lang="ts">
import type { DbJobOutput } from '~/types/database.types'

const props = defineProps<{ projectId: string }>()

const tones = ['Educational', 'Narrative', 'Promotional', 'Conversational', 'Documentary', 'Inspirational']

const idea = ref('')
const tone = ref('Educational')
const selectedId = ref<string | null>(null)
const selectedScript = ref<DbJobOutput | null>(null)

const { job, isRunning, isFailed, error: pollerError, startJob } = useJobPoller()

const candidates = computed<DbJobOutput[]>(() => {
  if (!job.value?.job_outputs) return []
  return job.value.job_outputs
    .filter(o => o.label?.startsWith('script_candidate_'))
    .sort((a, b) => (a.label ?? '').localeCompare(b.label ?? ''))
})

function scriptText(output: DbJobOutput): string {
  return (output.metadata as { content?: string } | null)?.content ?? ''
}

async function generate() {
  selectedId.value = null
  selectedScript.value = null
  await startJob(props.projectId, 'script', { idea: idea.value.trim(), tone: tone.value })
}

function select(script: DbJobOutput) {
  selectedId.value = script.id
  selectedScript.value = script
}

function onUse(text: string) {
  // Handled by ScriptEditor — workspace store is updated there
}
</script>
