<template>
  <div class="relative flex flex-col gap-4 p-5 rounded-xl border border-white/10 bg-white/3">
    <button
      class="absolute right-4 top-4 w-8 h-8 rounded-full bg-black/40 border border-white/10 text-white/70 hover:text-white hover:bg-black/60 flex items-center justify-center transition-colors disabled:opacity-50"
      title="Download audio"
      :disabled="downloading"
      @click="downloadAudio"
    >
      <span v-if="downloading" class="inline-block w-3.5 h-3.5 border-2 border-white/50 border-t-transparent rounded-full animate-spin" />
      <svg v-else xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <path d="M7 10l5 5 5-5"/>
        <path d="M12 15V3"/>
      </svg>
    </button>

    <!-- Script highlight -->
    <div class="pr-10">
      <div class="min-h-[4.5rem] flex items-center">
        <p v-if="currentScene" class="text-sm text-gray-300 leading-relaxed">
          <template v-for="(token, i) in currentSceneTokens" :key="i">
            <br v-if="token === null" />
            <span
              v-else
              :class="token.idx === activeWordIndex ? 'text-white bg-white/15 rounded px-0.5' : ''"
            >{{ token.text + ' ' }}</span>
          </template>
        </p>
        <p v-else class="text-sm text-gray-600">Play to see script highlighted here.</p>
      </div>
    </div>

    <!-- Hidden audio element -->
    <audio ref="audioEl" :src="audioUrl" preload="metadata" @loadedmetadata="onLoaded" />

    <!-- Waveform / progress bar -->
    <div
      class="relative w-full h-1.5 bg-white/10 rounded-full cursor-pointer group"
      @click="seek"
    >
      <div
        class="h-full bg-white/60 rounded-full transition-none"
        :style="{ width: `${progress * 100}%` }"
      />
      <!-- Scrubber dot -->
      <div
        class="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
        :style="{ left: `calc(${progress * 100}% - 6px)` }"
      />
    </div>

    <!-- Controls -->
    <div class="flex items-center gap-4">
      <!-- Play / Pause -->
      <button
        class="w-9 h-9 flex items-center justify-center rounded-full bg-white text-gray-950 hover:bg-gray-100 transition-colors"
        :title="playing ? 'Pause' : 'Play'"
        @click="togglePlay"
      >
        <svg v-if="!playing" xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M8 5v14l11-7z"/>
        </svg>
        <svg v-else xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
        </svg>
      </button>

      <!-- Time -->
      <span class="text-xs text-gray-500 tabular-nums w-24">
        {{ formatTime(currentTime) }} / {{ formatTime(duration) }}
      </span>

      <!-- Scene indicator -->
      <span v-if="currentScene" class="text-xs text-gray-600 ml-auto">
        Scene {{ (currentScene.order_index ?? 0) + 1 }}
      </span>

      <!-- Speed -->
      <select
        v-model="playbackRate"
        class="text-xs bg-gray-800 border border-white/10 rounded px-2 py-1 text-gray-300 focus:outline-none"
        @change="applyRate"
      >
        <option value="0.75">0.75×</option>
        <option value="1">1×</option>
        <option value="1.25">1.25×</option>
        <option value="1.5">1.5×</option>
      </select>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { DbScene } from '~/types/database.types'

const props = defineProps<{
  audioUrl: string
  scenes: DbScene[]
  sceneImages?: Map<string, string>
}>()

const audioEl = ref<HTMLAudioElement | null>(null)
const playing = ref(false)
const currentTime = ref(0)
const duration = ref(0)
const playbackRate = ref<number>(1)
const downloading = ref(false)

const progress = computed(() => duration.value ? currentTime.value / duration.value : 0)

// Find which scene is active at currentTime
const currentScene = computed(() =>
  [...props.scenes]
    .reverse()
    .find(s => currentTime.value >= (s.start_time ?? 0)) ?? props.scenes[0] ?? null,
)

const currentSceneWords = computed(() =>
  currentScene.value?.script_text.split(/\s+/).filter(Boolean) ?? [],
)

const currentSceneTokens = computed<Array<{ text: string; idx: number } | null>>(() => {
  const text = currentScene.value?.script_text ?? ''
  const tokens: Array<{ text: string; idx: number } | null> = []
  let wordIdx = 0
  const paragraphs = text.split(/\n\n+/)
  for (let p = 0; p < paragraphs.length; p++) {
    if (p > 0) tokens.push(null)
    for (const word of (paragraphs[p] ?? '').split(/\s+/).filter(Boolean)) {
      tokens.push({ text: word, idx: wordIdx++ })
    }
  }
  return tokens
})

// Approximate word highlight: divide scene duration evenly across words
const activeWordIndex = computed(() => {
  if (!currentScene.value) return -1
  const sceneStart = currentScene.value.start_time ?? 0
  const sceneDuration = currentScene.value.duration ?? 1
  const elapsed = currentTime.value - sceneStart
  const wordCount = currentSceneWords.value.length
  if (wordCount === 0) return -1
  return Math.min(Math.floor((elapsed / sceneDuration) * wordCount), wordCount - 1)
})

function onLoaded() {
  if (audioEl.value) duration.value = audioEl.value.duration
}

function togglePlay() {
  if (!audioEl.value) return
  if (playing.value) {
    audioEl.value.pause()
    playing.value = false
  } else {
    audioEl.value.play()
    playing.value = true
  }
}

function seek(e: MouseEvent) {
  if (!audioEl.value || !duration.value) return
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  const ratio = (e.clientX - rect.left) / rect.width
  audioEl.value.currentTime = ratio * duration.value
}

function applyRate() {
  if (audioEl.value) audioEl.value.playbackRate = Number(playbackRate.value)
}

async function downloadAudio() {
  downloading.value = true
  try {
    const response = await fetch(props.audioUrl)
    if (!response.ok) throw new Error(`Download failed: ${response.status}`)

    const blob = await response.blob()
    const objectUrl = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = objectUrl
    anchor.download = `audio-track.${extensionFromAudioUrl()}`
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(objectUrl)
  } finally {
    downloading.value = false
  }
}

function extensionFromAudioUrl(): string {
  try {
    const path = new URL(props.audioUrl).pathname
    const extension = path.split('.').pop()?.toLowerCase()
    return extension && extension.length <= 5 ? extension : 'mp3'
  } catch {
    return 'mp3'
  }
}

function formatTime(s: number): string {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${String(sec).padStart(2, '0')}`
}

// Sync currentTime via requestAnimationFrame for smooth updates
let rafId = 0
function tick() {
  if (audioEl.value) currentTime.value = audioEl.value.currentTime
  rafId = requestAnimationFrame(tick)
}

onMounted(() => { rafId = requestAnimationFrame(tick) })
onUnmounted(() => {
  cancelAnimationFrame(rafId)
  audioEl.value?.pause()
})
</script>
