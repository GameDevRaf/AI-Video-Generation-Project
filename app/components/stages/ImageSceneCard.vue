<template>
  <div class="flex flex-col gap-3 p-4 rounded-xl border border-white/10 bg-white/3">
    <div class="flex items-center justify-between">
      <span class="text-xs font-medium text-gray-500">
        Scene {{ scene.order_index + 1 }}{{ scene.title ? ` - ${scene.title}` : '' }}
      </span>
      <span class="text-xs text-gray-600">{{ scene.duration }}s</span>
    </div>

    <button
      type="button"
      class="w-full aspect-video rounded-lg overflow-hidden bg-white/5 border border-white/8 flex items-center justify-center disabled:cursor-default"
      :disabled="!imageUrl"
      data-testid="image-preview-trigger"
      @click="imageUrl && $emit('view-image', scene.id)"
    >
      <img
        v-if="imageUrl"
        :src="imageUrl"
        :alt="`Scene ${scene.order_index + 1}`"
        class="w-full h-full object-cover"
      />
      <div v-else class="flex flex-col items-center gap-2 text-gray-600">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
          <path d="m21 15-5-5L5 21"/>
        </svg>
        <span class="text-xs">No image yet</span>
      </div>
    </button>

    <div class="flex flex-col gap-1.5">
      <div class="flex items-center justify-between">
        <label class="text-xs text-gray-500">Image prompt</label>
        <button
          v-if="isDirty"
          class="text-xs text-white/50 hover:text-white transition-colors"
          @click="save"
        >
          Save
        </button>
      </div>
      <textarea
        v-model="localPrompt"
        rows="3"
        :placeholder="hasPrompt ? '' : 'Generate prompts first, or type your own...'"
        class="w-full px-3 py-2 bg-white/5 border border-white/8 rounded-lg text-xs text-gray-300 leading-relaxed placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-white/15 resize-none"
        @input="onInput"
        @blur="saveIfDirty"
      />
    </div>

    <div class="flex items-center justify-between gap-2">
      <div class="flex items-center gap-2 min-w-0">
        <!-- Regen/Gen image button — orange dot appears after tab return when prompt differs from generation -->
        <div class="relative">
          <span
            v-if="sessionMismatch"
            class="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-orange-400 z-10 pointer-events-none"
            data-testid="prompt-mismatch-dot"
            title="Current prompt differs from the one used to generate this image"
          />
          <button
            :disabled="!localPrompt.trim() || generating"
            class="px-2.5 py-1.5 bg-white/8 border border-white/10 text-white rounded-lg text-xs font-medium hover:bg-white/12 transition-colors disabled:opacity-40 whitespace-nowrap"
            @click="$emit('generate-image', scene.id, localPrompt)"
          >
            <span v-if="generating" class="flex items-center gap-1.5">
              <span class="inline-block w-2.5 h-2.5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
              Gen...
            </span>
            <span v-else>{{ imageUrl ? 'Regen image' : 'Gen image' }}</span>
          </button>
        </div>

        <input
          ref="fileInput"
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          class="hidden"
          @change="onFileChange"
        />
        <button
          :disabled="uploading"
          class="px-2.5 py-1.5 border border-white/10 text-gray-300 rounded-lg text-xs font-medium hover:bg-white/5 transition-colors disabled:opacity-40 whitespace-nowrap"
          @click="fileInput?.click()"
        >
          <span v-if="uploading">Upload...</span>
          <span v-else>{{ imageUrl ? 'Replace' : 'Upload' }}</span>
        </button>
      </div>

      <!-- Regenerate-prompt button -->
      <button
        :disabled="generatingPrompt"
        class="shrink-0 p-1.5 rounded-lg border border-white/10 text-gray-500 hover:text-gray-200 hover:border-white/20 transition-colors disabled:opacity-40"
        title="Regenerate prompt for this scene"
        data-testid="image-regenerate-prompt"
        @click="$emit('regenerate-prompt', scene.id)"
      >
        <span v-if="generatingPrompt" class="inline-block w-3 h-3 border border-gray-500 border-t-gray-200 rounded-full animate-spin" />
        <svg v-else xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/>
          <path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/>
        </svg>
      </button>
    </div>

    <span v-if="providerError" class="text-xs text-amber-400/80">{{ providerError }}</span>
  </div>
</template>

<script setup lang="ts">
import type { DbScene } from '~/types/database.types'

const props = defineProps<{
  scene: DbScene
  prompt: string
  hasPrompt: boolean
  imageUrl: string | null
  /** Prompt that was used when the current image was generated (from server metadata). */
  generationPrompt?: string
  /**
   * Set to true by the parent stage once fetchPrompts + fetchImages have both resolved
   * (after mount / tab return). The card uses this single rising edge to snapshot whether
   * there is a mismatch, so the dot never appears during an active in-session edit.
   */
  dataLoaded?: boolean
  generating: boolean
  generatingPrompt: boolean
  uploading?: boolean
  providerError?: string
}>()

const emit = defineEmits<{
  'save-prompt': [sceneId: string, prompt: string]
  'generate-image': [sceneId: string, prompt: string]
  'regenerate-prompt': [sceneId: string]
  'upload-image': [sceneId: string, file: File]
  'view-image': [sceneId: string]
}>()

const fileInput = ref<HTMLInputElement | null>(null)
const localPrompt = ref(props.prompt)
const userHasEdited = ref(false)

const isDirty = computed(() => localPrompt.value !== props.prompt)

// Orange dot: captured once when the parent signals all server data has loaded (dataLoaded
// goes false→true on mount / tab return). Frozen for the rest of the session so it never
// flickers during active editing. Can only be cleared when user generates a new image that
// matches the current saved prompt, at which point the mismatch is resolved.
const sessionMismatch = ref(false)

watch(() => props.dataLoaded, (loaded) => {
  if (loaded) {
    sessionMismatch.value = !!props.imageUrl && !!props.generationPrompt && props.prompt !== props.generationPrompt
  }
}, { immediate: true })

// Clear the dot when a new generation resolves the mismatch.
watch(() => props.generationPrompt, (gp) => {
  if (sessionMismatch.value && gp === props.prompt) {
    sessionMismatch.value = false
  }
})

function onInput() {
  userHasEdited.value = true
}

watch(() => props.generatingPrompt, (cur, prev) => {
  if (prev && !cur) userHasEdited.value = false
})

watch(() => props.prompt, (newVal) => {
  if (!userHasEdited.value) localPrompt.value = newVal
})

function save() {
  emit('save-prompt', props.scene.id, localPrompt.value)
}

function saveIfDirty() {
  if (isDirty.value) save()
}

function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) emit('upload-image', props.scene.id, file)
  input.value = ''
}
</script>
