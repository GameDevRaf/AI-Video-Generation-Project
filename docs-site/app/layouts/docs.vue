<script setup lang="ts">
const leftAsideCollapsed = useState('docs-left-aside-collapsed', () => false)

onMounted(() => {
  leftAsideCollapsed.value = localStorage.getItem('docs-left-aside-collapsed') === 'true'
})

watch(leftAsideCollapsed, (value) => {
  if (import.meta.client) {
    localStorage.setItem('docs-left-aside-collapsed', String(value))
  }
})

const toggleLeftAside = () => {
  leftAsideCollapsed.value = !leftAsideCollapsed.value
}
</script>

<template>
  <UMain>
    <UContainer>
      <div class="relative">
        <UButton
          v-if="leftAsideCollapsed"
          class="hidden lg:inline-flex fixed left-4 top-24 z-40"
          color="neutral"
          variant="subtle"
          icon="i-lucide-panel-left-open"
          aria-label="Show navigation sidebar"
          title="Show navigation sidebar"
          @click="toggleLeftAside"
        />

        <UPage>
          <template
            v-if="!leftAsideCollapsed"
            #left
          >
            <UPageAside>
              <div class="hidden lg:flex justify-end mb-3">
                <UButton
                  color="neutral"
                  variant="ghost"
                  size="sm"
                  icon="i-lucide-panel-left-close"
                  aria-label="Hide navigation sidebar"
                  title="Hide navigation sidebar"
                  @click="toggleLeftAside"
                />
              </div>

              <DocsAsideLeftTop />
              <DocsAsideLeftBody />
            </UPageAside>
          </template>

          <slot />
        </UPage>
      </div>
    </UContainer>
  </UMain>
</template>
