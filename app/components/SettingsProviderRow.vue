<template>
  <div class="flex items-start justify-between gap-8 py-4 border-b border-white/8">
    <div class="flex flex-col gap-1">
      <span class="text-sm text-gray-200">{{ label }}</span>
      <span class="text-xs text-gray-500">{{ description }}</span>
    </div>
    <select
      :value="selectedProviderId"
      class="bg-gray-800 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-white/20 shrink-0"
      @change="$emit('providerChange', ($event.target as HTMLSelectElement).value)"
    >
      <option v-for="p in providers" :key="p.id" :value="p.id">{{ p.displayName }}</option>
    </select>
  </div>
</template>

<script setup lang="ts">
import type { ProviderMeta } from '~/utils/providerCatalog'

defineProps<{
  label: string
  description: string
  providers: ProviderMeta[]
  selectedProviderId: string
}>()

defineEmits<{ providerChange: [value: string] }>()
</script>
