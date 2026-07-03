<template>
  <button
    type="button"
    :disabled="creating"
    class="flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-white/15 text-sm text-gray-500 hover:text-gray-200 hover:border-white/30 transition-colors disabled:opacity-40"
    data-testid="new-scene-button"
    @click="$emit('create')"
  >
    <span v-if="creating" class="inline-block w-3.5 h-3.5 border-2 border-gray-500 border-t-gray-200 rounded-full animate-spin" />
    <svg v-else xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 5v14"/><path d="M5 12h14"/>
    </svg>
    <span>{{ creating ? 'Adding scene…' : 'Add scene' }}</span>
  </button>
</template>

<script setup lang="ts">
defineProps<{ creating?: boolean }>()
defineEmits<{ create: [] }>()
</script>
