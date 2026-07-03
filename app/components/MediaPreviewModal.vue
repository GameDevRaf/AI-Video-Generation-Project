<template>
  <Teleport to="body">
    <Transition name="media-preview">
      <div
        v-if="open"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/85 px-4 py-6"
        @click.self="$emit('close')"
      >
        <div class="media-preview-panel relative max-w-6xl max-h-[92vh] flex flex-col items-center gap-3">
          <div class="absolute right-3 top-3 z-10 flex items-center gap-2">
            <button
              class="w-9 h-9 rounded-full bg-black/70 border border-white/15 text-white/80 hover:text-white hover:bg-black/90 flex items-center justify-center transition-colors disabled:opacity-50"
              title="Download media"
              :disabled="downloading"
              @click.stop="downloadMedia"
            >
              <span v-if="downloading" class="inline-block w-3.5 h-3.5 border-2 border-white/50 border-t-transparent rounded-full animate-spin" />
              <svg v-else xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <path d="M7 10l5 5 5-5"/>
                <path d="M12 15V3"/>
              </svg>
            </button>
            <button
              class="w-9 h-9 rounded-full bg-black/70 border border-white/15 text-white/80 hover:text-white hover:bg-black/90 flex items-center justify-center transition-colors"
              title="Close preview"
              @click="$emit('close')"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M18 6 6 18"/>
                <path d="m6 6 12 12"/>
              </svg>
            </button>
          </div>

          <div class="min-h-0 rounded-lg overflow-hidden border border-white/10 bg-black shadow-2xl">
            <img
              v-if="type === 'image'"
              :src="url"
              :alt="title"
              class="max-h-[88vh] max-w-[90vw] w-auto h-auto object-contain block"
            />
            <video
              v-else
              :src="url"
              class="max-h-[88vh] max-w-[90vw] w-auto h-auto object-contain bg-black block"
              controls
              autoplay
              playsinline
            />
          </div>
          <p v-if="title" class="text-sm text-gray-400 truncate px-1 max-w-[90vw]">{{ title }}</p>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
const props = defineProps<{
  open: boolean
  url: string
  type: 'image' | 'video'
  title?: string
  downloadName?: string
}>()

defineEmits<{ close: [] }>()

const downloading = ref(false)

async function downloadMedia() {
  downloading.value = true
  try {
    const response = await fetch(props.url)
    if (!response.ok) throw new Error(`Download failed: ${response.status}`)

    const blob = await response.blob()
    const objectUrl = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = objectUrl
    anchor.download = props.downloadName || fallbackDownloadName()
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(objectUrl)
  } finally {
    downloading.value = false
  }
}

function fallbackDownloadName() {
  const extension = props.type === 'image' ? 'png' : 'mp4'
  return `media.${extension}`
}
</script>

<style scoped>
.media-preview-enter-active,
.media-preview-leave-active {
  transition: opacity 140ms ease-out;
}

.media-preview-enter-active .media-preview-panel,
.media-preview-leave-active .media-preview-panel {
  transition: transform 140ms ease-out, opacity 140ms ease-out;
}

.media-preview-enter-from,
.media-preview-leave-to {
  opacity: 0;
}

.media-preview-enter-from .media-preview-panel,
.media-preview-leave-to .media-preview-panel {
  opacity: 0;
  transform: scale(0.985);
}
</style>
