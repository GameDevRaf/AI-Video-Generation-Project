<template>
  <div
    class="flex flex-col gap-3 p-4 rounded-xl border transition-colors"
    :class="isActive ? 'border-white/30 bg-white/5' : 'border-white/10 bg-white/3'"
  >
    <!-- Scene label -->
    <div class="flex items-center justify-between">
      <span class="text-xs font-medium text-gray-500">
        Scene {{ scene.order_index + 1 }}{{ scene.title ? ` · ${scene.title}` : '' }}
      </span>
      <span class="text-xs text-gray-600">{{ scene.duration }}s</span>
    </div>

    <!-- Video player or image placeholder -->
    <div class="w-full aspect-video rounded-lg overflow-hidden bg-black border border-white/8 relative">
      <video
        v-if="videoUrl"
        :src="videoUrl"
        :controls="isActive"
        class="w-full h-full object-cover"
        preload="metadata"
        loop
        @click="$emit('select', scene.id)"
      />
      <div
        v-else
        class="w-full h-full flex items-center justify-center cursor-pointer"
        @click="$emit('select', scene.id)"
      >
        <img
          v-if="imageUrl"
          :src="imageUrl"
          :alt="`Scene ${scene.order_index + 1} frame`"
          class="w-full h-full object-cover opacity-60"
        />
        <div class="absolute inset-0 flex items-center justify-center">
          <div class="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-white/60" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z"/>
            </svg>
          </div>
        </div>
      </div>
    </div>

    <!-- Video prompt -->
    <div class="flex flex-col gap-1.5">
      <div class="flex items-center justify-between">
        <label class="text-xs text-gray-500">Motion prompt</label>
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
        rows="2"
        placeholder="Describe camera movement and action…"
        class="w-full px-3 py-2 bg-white/5 border border-white/8 rounded-lg text-xs text-gray-300 leading-relaxed placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-white/15 resize-none"
        @blur="saveIfDirty"
      />
    </div>

    <!-- Generate button -->
    <div class="flex items-center gap-2">
      <button
        :disabled="!localPrompt.trim() || generating"
        class="px-3 py-1.5 bg-white/8 border border-white/10 text-white rounded-lg text-xs font-medium hover:bg-white/12 transition-colors disabled:opacity-40"
        @click="$emit('generate-video', scene.id, localPrompt)"
      >
        <span v-if="generating" class="flex items-center gap-1.5">
          <span class="inline-block w-2.5 h-2.5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
          Generating…
        </span>
        <span v-else>{{ videoUrl ? 'Regenerate' : 'Generate video' }}</span>
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
  videoUrl: string | null
  imageUrl: string | null
  isActive: boolean
  generating: boolean
  providerError?: string
}>()

const emit = defineEmits<{
  'save-prompt': [sceneId: string, prompt: string]
  'generate-video': [sceneId: string, prompt: string]
  'select': [sceneId: string]
}>()

const localPrompt = ref(props.prompt)
const isDirty = computed(() => localPrompt.value !== props.prompt)

watch(() => props.prompt, val => { localPrompt.value = val })

function save() { emit('save-prompt', props.scene.id, localPrompt.value) }
function saveIfDirty() { if (isDirty.value) save() }
</script>
