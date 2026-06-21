<template>
  <!-- Dynamic Island-style pill tab bar -->
  <div class="flex items-center p-1 rounded-full bg-white/6 border border-white/[0.08]" style="gap: 2px">
    <button
      v-for="tab in tabs"
      :key="tab.id"
      :disabled="!tab.enabled"
      class="px-4 py-1.5 rounded-full text-xs font-medium transition-all duration-200 select-none"
      :class="[
        activeTab === tab.id
          ? 'bg-white text-gray-950 shadow-sm'
          : tab.enabled
            ? 'text-gray-400 hover:text-white hover:bg-white/8'
            : 'text-gray-600 cursor-not-allowed'
      ]"
      @click="tab.enabled && emit('update:activeTab', tab.id)"
    >
      {{ tab.label }}
    </button>
  </div>
</template>

<script setup lang="ts">
export type TabId = 'script' | 'image' | 'audio' | 'video'

const props = defineProps<{
  activeTab: TabId
  currentStage: string
}>()

const emit = defineEmits<{ 'update:activeTab': [tab: TabId] }>()

const STAGE_ORDER = ['script', 'scene_split', 'image', 'audio', 'video', 'export']

const tabs = computed(() => {
  const currentIdx = STAGE_ORDER.indexOf(props.currentStage)
  return [
    { id: 'script' as TabId, label: 'Script',  enabled: true },
    { id: 'image'  as TabId, label: 'Image',   enabled: currentIdx >= STAGE_ORDER.indexOf('image') },
    { id: 'audio'  as TabId, label: 'Audio',   enabled: currentIdx >= STAGE_ORDER.indexOf('audio') },
    { id: 'video'  as TabId, label: 'Video',   enabled: currentIdx >= STAGE_ORDER.indexOf('video') },
  ]
})
</script>
