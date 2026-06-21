<template>
  <div class="h-screen bg-gray-950 text-white flex flex-col overflow-hidden">
    <!-- Top bar -->
    <header class="shrink-0 flex items-center justify-between px-5 py-3 border-b border-white/10">
      <div class="flex items-center gap-3">
        <NuxtLink to="/dashboard" class="text-gray-400 hover:text-white transition-colors text-sm">
          ← Projects
        </NuxtLink>
        <span class="text-white/20">/</span>
        <span class="text-sm text-gray-200 truncate max-w-xs">{{ projectName }}</span>
      </div>
      <!-- Model selector slot — stage-specific component fills this -->
      <slot name="model-selector" />
    </header>

    <!-- Stage content (scrollable) -->
    <main class="flex-1 overflow-y-auto">
      <slot />
    </main>

    <!-- Bottom timeline bar slot -->
    <slot name="timeline" />
  </div>
</template>

<script setup lang="ts">
defineProps<{
  projectName?: string
}>()
</script>
