<template>
  <div class="flex flex-col gap-3 p-4 rounded-xl border border-white/10 bg-white/3">
    <!-- Scene label -->
    <div class="flex items-center justify-between">
      <span class="text-xs font-medium text-gray-500">
        Scene {{ scene.order_index + 1 }}{{ scene.title ? ` · ${scene.title}` : '' }}
      </span>
      <span class="text-xs text-gray-600">{{ scene.duration }}s</span>
    </div>

    <!-- Image preview -->
    <div class="w-full aspect-video rounded-lg overflow-hidden bg-white/5 border border-white/8 flex items-center justify-center">
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
    </div>

    <!-- Prompt -->
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
        :placeholder="hasPrompt ? '' : 'Generate prompts first, or type your own…'"
        class="w-full px-3 py-2 bg-white/5 border border-white/8 rounded-lg text-xs text-gray-300 leading-relaxed placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-white/15 resize-none"
        @blur="saveIfDirty"
      />
    </div>

    <!-- Generate image + regenerate prompt (same row) -->
    <div class="flex items-center gap-2">
      <button
        :disabled="!localPrompt.trim() || generating"
        class="px-3 py-1.5 bg-white/8 border border-white/10 text-white rounded-lg text-xs font-medium hover:bg-white/12 transition-colors disabled:opacity-40"
        @click="$emit('generate-image', scene.id, localPrompt)"
      >
        <span v-if="generating" class="flex items-center gap-1.5">
          <span class="inline-block w-2.5 h-2.5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
          Generating…
        </span>
        <span v-else>{{ imageUrl ? 'Regenerate image' : 'Generate image' }}</span>
      </button>

      <!-- Regenerate prompt icon — same row, right of the image button -->
      <button
        :disabled="generatingPrompt"
        class="p-1.5 rounded-lg border border-white/10 text-gray-500 hover:text-gray-200 hover:border-white/20 transition-colors disabled:opacity-40"
        title="Regenerate prompt for this scene"
        @click="$emit('regenerate-prompt', scene.id)"
      >
        <span v-if="generatingPrompt" class="inline-block w-3 h-3 border border-gray-500 border-t-gray-200 rounded-full animate-spin" />
        <svg v-else xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/>
          <path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/>
        </svg>
      </button>

      <span v-if="providerError" class="text-xs text-amber-400/80">{{ providerError }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { DbScene } from '~/types/database.types'

const props = defineProps<{
  scene: DbScene
  prompt: string
  hasPrompt: boolean
  imageUrl: string | null
  generating: boolean
  generatingPrompt: boolean
  providerError?: string
}>()

const emit = defineEmits<{
  'save-prompt': [sceneId: string, prompt: string]
  'generate-image': [sceneId: string, prompt: string]
  'regenerate-prompt': [sceneId: string]
}>()

const localPrompt = ref(props.prompt)
const isDirty = computed(() => localPrompt.value !== props.prompt)

// Sync when parent updates prompt (after a generate-all-prompts job)
watch(() => props.prompt, (val) => { localPrompt.value = val })

function save() {
  emit('save-prompt', props.scene.id, localPrompt.value)
}

function saveIfDirty() {
  if (isDirty.value) save()
}
</script>
