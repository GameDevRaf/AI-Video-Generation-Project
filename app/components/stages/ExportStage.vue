<template>
  <section class="flex flex-col gap-8 px-8 py-10 max-w-5xl mx-auto w-full">
    <div class="flex flex-col gap-1">
      <h2 class="text-lg font-semibold">Export</h2>
      <p class="text-sm text-gray-500">Review your project and export the final video.</p>
    </div>

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
          {{ stat.ready ? 'Ready' : 'Not generated' }}
        </span>
      </div>
    </div>

    <div class="flex items-center gap-4 flex-wrap">
      <div class="relative">
        <span
          v-if="showExportStaleDot"
          class="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-orange-400 z-10 pointer-events-none"
          data-testid="export-stale-dot"
          title="Something in the next export changed since the last MP4"
        />
        <button
          :disabled="isRunning || !scenes.length || mediaReadyCount === 0"
          class="px-6 py-2.5 bg-white text-gray-950 rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors disabled:opacity-40"
          @click="startExport"
        >
          <span v-if="isRunning" class="flex items-center gap-2">
            <span class="inline-block w-3.5 h-3.5 border-2 border-gray-400 border-t-gray-800 rounded-full animate-spin" />
            Exporting...
          </span>
          <span v-else>{{ latestExport ? 'Re-export MP4' : 'Export MP4' }}</span>
        </button>
      </div>

      <span
        v-if="skipVideoGen"
        class="text-xs px-2.5 py-1 rounded-full border border-white/10 text-gray-500"
      >
        Skip Video Gen enabled — exporting a slideshow from scene images
      </span>

      <p v-if="isFailed" class="text-sm text-red-400">
        {{ job?.error_message ?? 'Export failed.' }}
      </p>
    </div>

    <div v-if="latestExport" class="flex flex-col gap-4 p-5 rounded-xl border border-white/10 bg-white/3">
      <div class="flex items-center justify-between">
        <h3 class="text-sm font-medium text-gray-200">Export ready</h3>
        <span class="text-xs text-gray-500">{{ formatDate(latestExport.created_at) }}</span>
      </div>

      <div class="flex flex-col gap-2">
        <div
          v-for="item in assetChecklist"
          :key="item.label"
          class="flex items-center gap-2.5 text-sm"
        >
          <span :class="item.ready ? 'text-green-400' : 'text-gray-600'">
            {{ item.ready ? 'Ready' : 'Missing' }}
          </span>
          <span :class="item.ready ? 'text-gray-300' : 'text-gray-600'">{{ item.label }}</span>
          <span v-if="item.detail" class="text-xs text-gray-600 ml-auto">{{ item.detail }}</span>
        </div>
      </div>

      <div class="pt-2 flex items-center gap-3 flex-wrap">
        <button
          v-if="latestExport.storage_url"
          class="px-4 py-2 border border-white/15 text-gray-200 rounded-lg text-sm font-medium hover:bg-white/5 transition-colors"
          @click="openExportPreview"
        >
          Download MP4
        </button>
        <button
          v-if="manifest"
          class="px-4 py-2 border border-white/15 text-gray-200 rounded-lg text-sm font-medium hover:bg-white/5 transition-colors"
          @click="downloadManifest"
        >
          Download manifest JSON
        </button>
      </div>
    </div>

    <MediaPreviewModal
      v-if="exportPreviewUrl"
      :open="!!exportPreviewUrl"
      :url="exportPreviewUrl"
      type="video"
      title="Final export"
      :download-name="`project-${props.projectId.slice(0, 8)}.mp4`"
      @close="exportPreviewUrl = null"
    />

    <div class="flex gap-3 p-4 rounded-xl border border-white/10 bg-white/3">
      <span class="text-gray-400 shrink-0">MP4</span>
      <div class="flex flex-col gap-1">
        <p class="text-sm text-gray-300 font-medium">Assembly normalizes source media</p>
        <p class="text-xs text-gray-500 leading-relaxed">
          Export converts scene clips and audio to MP4-compatible streams, then concatenates video clips and muxes the final audio track.
        </p>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
const props = defineProps<{ projectId: string }>()

const projectStore = useProjectStore()
const { scenes, fetchScenes } = useScenes(toRef(props, 'projectId'))
const { job, isRunning, isFailed, isDone, startJob } = useJobPoller()

interface ExportRecord {
  id: string
  created_at: string
  export_type: string
  storage_url: string | null
  metadata: Record<string, unknown> | null
}

const exports = ref<ExportRecord[]>([])
const latestExport = computed(() => exports.value[0] ?? null)
const manifest = ref<Record<string, unknown> | null>(null)
const audioUrl = ref<string | null>(null)
const audioCreatedAt = ref<string | null>(null)
const sceneVideos = ref<Map<string, { url: string; createdAt: string }>>(new Map())
const sceneImages = ref<Map<string, { url: string; createdAt: string }>>(new Map())
const exportPreviewUrl = ref<string | null>(null)
const dataLoaded = ref(false)
const exportMismatchSnapshot = ref(false)

// Skip Video Gen (toggled on the Video tab) makes export build a slideshow from scene
// images instead of generated video clips, so readiness must track images in that mode.
const skipVideoGen = computed(() => projectStore.settings?.skip_video_gen ?? false)
const videoCount = computed(() => scenes.value.filter(scene => sceneVideos.value.has(scene.id)).length)
const imageCount = computed(() => scenes.value.filter(scene => sceneImages.value.has(scene.id)).length)
const mediaReadyCount = computed(() => skipVideoGen.value ? imageCount.value : videoCount.value)
const totalDuration = computed(() => scenes.value.reduce((s, sc) => s + (sc.duration ?? 0), 0))
const currentExportMode = computed(() => skipVideoGen.value ? 'images_only' : 'video')
const latestExportManifest = computed(() => {
  const metadata = latestExport.value?.metadata
  return metadata
    ? (metadata.manifest as Record<string, unknown> | undefined) ?? metadata
    : null
})
const exportMismatch = computed(() => {
  if (!latestExport.value) return false

  const exportCreatedAt = Date.parse(latestExport.value.created_at)
  if (Number.isNaN(exportCreatedAt)) return false

  const exportedMode = latestExportManifest.value?.mode
  if (exportedMode && exportedMode !== currentExportMode.value) return true

  if (audioCreatedAt.value) {
    const audioTs = Date.parse(audioCreatedAt.value)
    if (!Number.isNaN(audioTs) && audioTs > exportCreatedAt) return true
  }

  const relevantMedia = skipVideoGen.value ? sceneImages.value : sceneVideos.value
  for (const scene of scenes.value) {
    const asset = relevantMedia.get(scene.id)
    if (!asset) continue
    const assetTs = Date.parse(asset.createdAt)
    if (!Number.isNaN(assetTs) && assetTs > exportCreatedAt) return true
  }

  return false
})
const showExportStaleDot = computed(() => !!latestExport.value && dataLoaded.value && exportMismatchSnapshot.value)

onMounted(async () => {
  await fetchScenes()
  await Promise.all([loadExports(), loadCurrentMedia()])
  dataLoaded.value = true
  exportMismatchSnapshot.value = exportMismatch.value
})

watch(isDone, async (done) => {
  if (!done) return
  await Promise.all([loadExports(), loadCurrentMedia()])
  dataLoaded.value = true
  exportMismatchSnapshot.value = exportMismatch.value
})

async function loadExports() {
  exports.value = await $fetch<ExportRecord[]>('/api/exports', {
    query: { projectId: props.projectId },
  })
  const metadata = latestExport.value?.metadata
  manifest.value = metadata
    ? (metadata.manifest as Record<string, unknown> | undefined) ?? metadata
    : null
}

async function loadCurrentMedia() {
  const [audio, videos, images] = await Promise.all([
    $fetch<{ url: string; createdAt: string } | null>('/api/audio', { query: { projectId: props.projectId } }),
    $fetch<{ sceneId: string; url: string; createdAt: string }[]>('/api/videos', { query: { projectId: props.projectId } }),
    $fetch<{ sceneId: string; url: string; createdAt: string }[]>('/api/images', { query: { projectId: props.projectId } }),
  ])
  audioUrl.value = audio?.url ?? null
  audioCreatedAt.value = audio?.createdAt ?? null
  sceneVideos.value = new Map(videos.map(v => [v.sceneId, { url: v.url, createdAt: v.createdAt }]))
  sceneImages.value = new Map(images.map(i => [i.sceneId, { url: i.url, createdAt: i.createdAt }]))
}

async function startExport() {
  await loadCurrentMedia()
  await startJob(props.projectId, 'export', {})
}

function openExportPreview() {
  if (!latestExport.value?.storage_url) return
  exportPreviewUrl.value = latestExport.value.storage_url
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

const stats = computed(() => [
  { label: 'Scenes', value: String(scenes.value.length), ready: scenes.value.length > 0 },
  {
    label: 'Duration',
    value: scenes.value.length ? formatDuration(totalDuration.value) : '-',
    ready: scenes.value.length > 0,
  },
  { label: 'Audio', value: audioUrl.value ? 'Yes' : 'No', ready: !!audioUrl.value },
  {
    label: skipVideoGen.value ? 'Images' : 'Videos',
    value: scenes.value.length ? `${mediaReadyCount.value} / ${scenes.value.length}` : '-',
    ready: scenes.value.length > 0 && mediaReadyCount.value === scenes.value.length,
  },
])

const assetChecklist = computed(() => [
  { label: 'Script', ready: scenes.value.length > 0, detail: `${scenes.value.length} scenes` },
  { label: 'Audio track', ready: !!audioUrl.value, detail: null },
  {
    label: skipVideoGen.value ? 'Scene images' : 'Video clips',
    ready: scenes.value.length > 0 && mediaReadyCount.value === scenes.value.length,
    detail: mediaReadyCount.value ? `${mediaReadyCount.value} ${skipVideoGen.value ? 'images' : 'clips'}` : null,
  },
  { label: 'MP4 file', ready: !!latestExport.value?.storage_url, detail: null },
])

function formatDuration(s: number): string {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${String(sec).padStart(2, '0')}`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString()
}
</script>
