<template>
  <div class="h-screen bg-gray-950 text-white flex flex-col overflow-hidden">
    <!-- Top bar — three columns: breadcrumb | tabs | model selector -->
    <header class="shrink-0 grid grid-cols-3 items-center px-5 py-3 border-b border-white/10">
      <div class="flex items-center gap-3">
        <NuxtLink to="/dashboard" class="text-gray-400 hover:text-white transition-colors text-sm">
          ← Projects
        </NuxtLink>
        <span class="text-white/20">/</span>
        <span class="text-sm text-gray-200 truncate max-w-xs">{{ projectName }}</span>
      </div>

      <!-- Stage tab bar — centered -->
      <div class="flex justify-center">
        <slot name="tabs" />
      </div>

      <!-- Model selector — right-aligned -->
      <div class="flex justify-end">
        <slot name="model-selector" />
      </div>
    </header>

    <!-- Stage content — overflow hidden; each tab manages its own scroll -->
    <main class="flex-1 overflow-hidden relative">
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
