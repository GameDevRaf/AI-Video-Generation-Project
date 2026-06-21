<template>
  <div class="flex gap-3 p-4 rounded-xl border border-white/10 bg-white/3 group">
    <!-- Order controls -->
    <div class="flex flex-col items-center gap-1 pt-1 shrink-0">
      <span class="text-xs text-gray-600 font-mono w-5 text-center">{{ scene.order_index + 1 }}</span>
      <button
        :disabled="isFirst"
        class="p-0.5 text-gray-600 hover:text-white transition-colors disabled:opacity-20"
        title="Move up"
        @click="$emit('move', scene.id, 'up')"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="m18 15-6-6-6 6"/>
        </svg>
      </button>
      <button
        :disabled="isLast"
        class="p-0.5 text-gray-600 hover:text-white transition-colors disabled:opacity-20"
        title="Move down"
        @click="$emit('move', scene.id, 'down')"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="m6 9 6 6 6-6"/>
        </svg>
      </button>
    </div>

    <!-- Main content -->
    <div class="flex-1 flex flex-col gap-3 min-w-0">
      <!-- Title -->
      <input
        :value="scene.title ?? ''"
        placeholder="Scene title"
        class="w-full bg-transparent text-sm font-medium text-gray-200 placeholder-gray-600 focus:outline-none border-b border-transparent focus:border-white/10 pb-0.5 transition-colors"
        @change="$emit('update', scene.id, { title: ($event.target as HTMLInputElement).value })"
      />

      <!-- Script text -->
      <textarea
        :value="scene.script_text"
        rows="4"
        class="w-full bg-white/4 border border-white/8 rounded-lg px-3 py-2 text-sm text-gray-300 leading-relaxed focus:outline-none focus:ring-1 focus:ring-white/15 resize-none"
        @change="$emit('update', scene.id, { script_text: ($event.target as HTMLTextAreaElement).value })"
      />

      <!-- Timestamps -->
      <div class="flex items-center gap-4 text-xs text-gray-500">
        <span>{{ formatTime(scene.start_time ?? 0) }} → {{ formatTime(scene.end_time ?? 0) }}</span>
        <div class="flex items-center gap-1.5">
          <span>Duration:</span>
          <input
            type="number"
            :value="scene.duration ?? 5"
            min="1"
            max="300"
            step="1"
            class="w-14 bg-white/5 border border-white/10 rounded px-1.5 py-0.5 text-xs text-white text-center focus:outline-none focus:ring-1 focus:ring-white/20"
            @change="$emit('update', scene.id, { duration: Number(($event.target as HTMLInputElement).value) })"
          />
          <span>s</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { DbScene } from '~/types/database.types'

defineProps<{
  scene: DbScene
  isFirst: boolean
  isLast: boolean
}>()

defineEmits<{
  update: [id: string, patch: Partial<Pick<DbScene, 'script_text' | 'title' | 'duration'>>]
  move: [id: string, direction: 'up' | 'down']
}>()

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}
</script>
