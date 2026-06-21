<template>
  <section class="flex flex-col gap-8 px-8 py-10 max-w-5xl mx-auto w-full">
    <!-- Header -->
    <div class="flex flex-col gap-1">
      <h2 class="text-lg font-semibold">Export</h2>
      <p class="text-sm text-gray-500">Review your project and export the final video.</p>
    </div>

    <!-- Project summary card -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <div
        v-for="stat in stats"
        :key="stat.label"
        class="flex flex-col gap-1 p-4 rounded-xl border border-white/10 bg-white/3"
      >
        <span class="text-xs text-gray-500">{{ stat.label }}</span>
        <span class="text-lg font-semibold" :class="stat.ready ? 'text-white' : 'text-gray-600'">
          {{ stat.value }}
        </span>
        <span class="text-xs" :class="stat.ready ? 'text-green-400' : 'text-gray-600'">
          {{ stat.ready ? '✓ Ready' : '— Not generated' }}
        </span>
      </div>
    </div>

    <!-- Export button -->
    <div class="flex items-center gap-4 flex-wrap">
      <button
        :disabled="isRunning || !scenes.length"
        class="px-6 py-2.5 bg-white text-gray-950 rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors disabled:opacity-40"
        @click="startExport"
      >
        <span v-if="isRunning" class="flex items-center gap-2">
          <span class="inline-block w-3.5 h-3.5 border-2 border-gray-400 border-t-gray-800 rounded-full animate-spin" />
          Exporting…
        </span>
        <span v-else>{{ latestExport ? 'Re-export' : 'Export project' }}</span>
      </button>

      <p v-if="isFailed" class="text-sm text-red-400">
        {{ job?.error_message ?? 'Export failed.' }}
      </p>
    </div>

    <!-- Export result -->
    <div v-if="latestExport" class="flex flex-col gap-4 p-5 rounded-xl border border-white/10 bg-white/3">
      <div class="flex items-center justify-between">
        <h3 class="text-sm font-medium text-gray-200">Export ready</h3>
        <span class="text-xs text-gray-500">{{ formatDate(latestExport.created_at) }}</span>
      </div>

      <!-- Asset checklist -->
      <div class="flex flex-col gap-2">
        <div
          v-for="item in assetChecklist"
          :key="item.label"
          class="flex items-center gap-2.5 text-sm"
        >
          <span :class="item.ready ? 'text-green-400' : 'text-gray-600'">
            {{ item.ready ? '✓' : '○' }}
          </span>
          <span :class="item.ready ? 'text-gray-300' : 'text-gray-600'">{{ item.label }}</span>
          <span v-if="item.detail" class="text-xs text-gray-600 ml-auto">{{ item.detail }}</span>
        </div>
      </div>

      <!-- Download manifest -->
      <div class="pt-2 flex items-center gap-3">
        <button
          class="px-4 py-2 border border-white/15 text-gray-200 rounded-lg text-sm font-medium hover:bg-white/5 transition-colors"
          @click="downloadManifest"
        >
          Download manifest JSON
        </button>
        <span class="text-xs text-gray-600">
          Contains all asset URLs + ffmpeg assembly instructions
        </span>
      </div>
    </div>

    <!-- ffmpeg note -->
    <div class="flex gap-3 p-4 rounded-xl border border-amber-400/15 bg-amber-400/5">
      <span class="text-amber-400 shrink-0">⚠</span>
      <div class="flex flex-col gap-1">
        <p class="text-sm text-amber-300 font-medium">MP4 assembly requires a video provider</p>
        <p class="text-xs text-amber-400/70 leading-relaxed">
          Wire an image provider (Phase 11) and video provider (Phase 13) to generate actual video clips,
          then the export handler in
          <code class="bg-white/5 px-1 rounded">server/worker/handlers/export.ts</code>
          can be extended with ffmpeg to concatenate them into a final MP4.
        </p>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
const props = defineProps<{ projectId: string }>()

const { scenes, fetchScenes } = useScenes(toRef(props, 'projectId'))
const { job, isRunning, isFailed, isDone, startJob } = useJobPoller()

interface ExportRecord {
  id: string
  created_at: string
  export_type: string
  metadata: Record<string, unknown> | null
}

const exports = ref<ExportRecord[]>([])
const latestExport = computed(() => exports.value[0] ?? null)

const manifest = ref<Record<string, unknown> | null>(null)

onMounted(async () => {
  await fetchScenes()
  await loadExports()
})

watch(isDone, async (done) => {
  if (done) await loadExports()
})

async function loadExports() {
  exports.value = await $fetch<ExportRecord[]>('/api/exports', {
    query: { projectId: props.projectId },
  })
  if (latestExport.value?.metadata) {
    manifest.value = latestExport.value.metadata as Record<string, unknown>
  }
}

async function startExport() {
  await startJob(props.projectId, 'export', {})
}

function downloadManifest() {
  if (!manifest.value) return
  const blob = new Blob([JSON.stringify(manifest.value, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `project-${props.projectId.slice(0, 8)}-manifest.json`
  a.click()
  URL.revokeObjectURL(url)
}

const totalDuration = computed(() =>
  scenes.value.reduce((s, sc) => s + (sc.duration ?? 0), 0),
)

const stats = computed(() => [
  { label: 'Scenes', value: String(scenes.value.length), ready: scenes.value.length > 0 },
  {
    label: 'Duration',
    value: scenes.value.length ? formatDuration(totalDuration.value) : '—',
    ready: scenes.value.length > 0,
  },
  { label: 'Audio', value: manifest.value?.audio_url ? 'Yes' : 'No', ready: !!manifest.value?.audio_url },
  {
    label: 'Videos',
    value: manifest.value
      ? `${(manifest.value.scenes as unknown[])?.filter((s: unknown) => (s as { video_url?: string }).video_url).length ?? 0} / ${scenes.value.length}`
      : '—',
    ready: false,
  },
])

const assetChecklist = computed(() => {
  const sc = manifest.value?.scenes as { video_url?: string }[] | undefined
  const videoCount = sc?.filter(s => s.video_url).length ?? 0
  return [
    { label: 'Script', ready: true, detail: `${scenes.value.length} scenes` },
    { label: 'Audio track', ready: !!manifest.value?.audio_url, detail: null },
    { label: 'Video clips', ready: videoCount > 0, detail: videoCount ? `${videoCount} clips` : null },
    { label: 'Manifest file', ready: !!latestExport.value, detail: null },
  ]
})

function formatDuration(s: number): string {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${String(sec).padStart(2, '0')}`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString()
}
</script>
