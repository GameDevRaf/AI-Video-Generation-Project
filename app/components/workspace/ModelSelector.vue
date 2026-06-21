<template>
  <div class="relative" data-testid="model-selector">
    <!-- Trigger pill -->
    <button
      class="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white px-3 py-1 rounded-full border border-white/10 hover:border-white/20 transition-colors"
      @click="open = !open"
    >
      <span class="text-gray-500">{{ stageLabel }}</span>
      <span class="text-white font-medium">{{ activeProviderName }}</span>
      <span class="text-gray-600">/</span>
      <span>{{ activeModelLabel }}</span>
      <svg xmlns="http://www.w3.org/2000/svg" class="w-3 h-3 ml-0.5 opacity-50" viewBox="0 0 24 24" fill="currentColor">
        <path d="M7 10l5 5 5-5z"/>
      </svg>
    </button>

    <!-- Dropdown -->
    <Transition name="fade-down">
      <div
        v-if="open"
        class="absolute right-0 top-full mt-1 w-72 bg-gray-900 border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden"
      >
        <div class="px-3 pt-2 pb-1 text-xs text-gray-500 font-medium uppercase tracking-wider border-b border-white/8">
          {{ stageLabel }} Provider
        </div>

        <div class="flex flex-col divide-y divide-white/5 max-h-80 overflow-y-auto">
          <div
            v-for="provider in providers"
            :key="provider.id"
            class="group"
            :data-testid="`provider-option-${provider.id}`"
          >
            <!-- Provider row -->
            <button
              class="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors text-left"
              :class="{ 'bg-white/5': selectedProviderId === provider.id }"
              @click="selectProvider(provider.id)"
            >
              <div class="flex flex-col gap-0.5">
                <span class="text-sm" :class="selectedProviderId === provider.id ? 'text-white' : 'text-gray-300'">
                  {{ provider.displayName }}
                </span>
                <span class="text-xs text-gray-600">{{ provider.defaultModel }}</span>
              </div>
              <div class="flex items-center gap-2 shrink-0">
                <span
                  v-if="savedProviderIds.includes(provider.id)"
                  class="text-xs text-green-400/80 bg-green-400/10 px-2 py-0.5 rounded-full"
                >
                  ✓ key saved
                </span>
                <span
                  v-else
                  class="text-xs text-amber-400/60 bg-amber-400/10 px-2 py-0.5 rounded-full"
                >
                  + key needed
                </span>
                <svg v-if="selectedProviderId === provider.id" xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                </svg>
              </div>
            </button>

            <!-- Inline key input (shown when provider has no key) -->
            <div
              v-if="inlineKeyForProvider === provider.id"
              class="px-4 pb-3 flex flex-col gap-2 bg-white/3"
            >
              <div class="text-xs text-gray-500">
                <template v-if="provider.dualCredentials && provider.dualCredentialFields">
                  Store both credentials as JSON: <code class="bg-white/5 px-1 rounded text-amber-300">{{ '{"' + provider.dualCredentialFields[0].split(' ')[0].toLowerCase() + '":"...","' + provider.dualCredentialFields[1].split(' ')[0].toLowerCase() + '":"..."}' }}</code>
                </template>
                <template v-else>Paste your {{ provider.displayName }} API key.</template>
              </div>
              <input
                v-model="inlineKeyValue"
                type="password"
                :placeholder="provider.dualCredentials ? 'Paste JSON credentials…' : 'Paste API key…'"
                class="w-full px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-white placeholder-gray-600 focus:outline-none font-mono"
                @keydown.enter="saveInlineKey(provider.id)"
              />
              <div class="flex gap-2">
                <button
                  :disabled="!inlineKeyValue.trim() || savingKey"
                  class="flex-1 py-1.5 bg-white text-gray-950 rounded-lg text-xs font-medium hover:bg-gray-100 transition-colors disabled:opacity-40"
                  @click="saveInlineKey(provider.id)"
                >
                  {{ savingKey ? 'Saving…' : 'Save & use' }}
                </button>
                <button
                  class="px-3 py-1.5 text-gray-500 hover:text-white text-xs transition-colors"
                  @click="inlineKeyForProvider = null; inlineKeyValue = ''"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Model sub-select for current provider -->
        <div v-if="currentProviderMeta?.models?.length > 1" class="p-3 border-t border-white/8 bg-white/2">
          <label class="text-xs text-gray-500 mb-1.5 block">Model</label>
          <select
            v-model="selectedModelId"
            class="w-full px-3 py-1.5 bg-gray-800 border border-white/10 rounded-lg text-xs text-white focus:outline-none"
            @change="emitChange"
          >
            <option v-for="m in currentProviderMeta.models" :key="m.id" :value="m.id">
              {{ m.label }}
            </option>
          </select>
        </div>
      </div>
    </Transition>

    <!-- Click-outside overlay -->
    <div v-if="open" class="fixed inset-0 z-40" @click="open = false" />
  </div>
</template>

<script setup lang="ts">
import { PROVIDER_CATALOG, getCatalogByCategory } from '~/utils/providerCatalog'

const props = defineProps<{
  stage: 'script' | 'image' | 'audio' | 'video'
  savedProviderIds: string[]
  initialProviderId?: string
  initialModelId?: string
}>()

const emit = defineEmits<{
  providerChanged: [providerId: string, modelId: string]
  openKeyPanel: []
}>()

const open = ref(false)
const inlineKeyForProvider = ref<string | null>(null)
const inlineKeyValue = ref('')
const savingKey = ref(false)

const stageLabels = { script: 'Script', image: 'Image', audio: 'Audio', video: 'Video' }
const stageLabel = computed(() => stageLabels[props.stage])

const providers = computed(() => getCatalogByCategory(props.stage))

const DEFAULTS: Record<string, string> = {
  script: 'anthropic',
  image: 'fal',
  audio: 'elevenlabs',
  video: 'runway',
}

const selectedProviderId = ref(props.initialProviderId ?? DEFAULTS[props.stage])
const selectedModelId = ref(
  props.initialModelId
    ?? PROVIDER_CATALOG.find(p => p.id === selectedProviderId.value)?.defaultModel
    ?? ''
)

// Re-evaluate the displayed provider whenever: the tab changes, the project's saved
// provider setting arrives, or the user's list of API keys changes.
// Also emits providerChanged so generate() functions read the correct provider
// from projectStore.settings rather than a stale default.
watch(
  [() => props.stage, () => props.initialProviderId, () => props.savedProviderIds],
  ([, newInitialId]) => {
    let id: string
    if (newInitialId) {
      id = newInitialId
    } else {
      const firstWithKey = providers.value.find(p => props.savedProviderIds.includes(p.id))
      id = firstWithKey?.id ?? DEFAULTS[props.stage]
    }
    const model = (newInitialId && props.initialModelId)
      ? props.initialModelId
      : PROVIDER_CATALOG.find(p => p.id === id)?.defaultModel ?? ''

    selectedProviderId.value = id
    selectedModelId.value = model
    emitChange()
  },
  { immediate: true },
)

const currentProviderMeta = computed(() =>
  PROVIDER_CATALOG.find(p => p.id === selectedProviderId.value)
)

const activeProviderName = computed(() => currentProviderMeta.value?.displayName ?? selectedProviderId.value)
const activeModelLabel = computed(() =>
  currentProviderMeta.value?.models.find(m => m.id === selectedModelId.value)?.label
    ?? selectedModelId.value
)

function selectProvider(id: string) {
  if (!props.savedProviderIds.includes(id)) {
    inlineKeyForProvider.value = inlineKeyForProvider.value === id ? null : id
    inlineKeyValue.value = ''
    return
  }
  inlineKeyForProvider.value = null
  selectedProviderId.value = id
  selectedModelId.value = PROVIDER_CATALOG.find(p => p.id === id)?.defaultModel ?? ''
  emitChange()
  open.value = false
}

function emitChange() {
  emit('providerChanged', selectedProviderId.value, selectedModelId.value)
}

interface ApiKeyMeta {
  id: string
  provider: string
  key_name: string | null
  is_active: boolean
  created_at: string
}

async function saveInlineKey(providerId: string) {
  if (!inlineKeyValue.value.trim()) return
  savingKey.value = true
  try {
    await $fetch<ApiKeyMeta>('/api/provider/keys', {
      method: 'POST',
      body: { provider: providerId, secret: inlineKeyValue.value.trim() },
    })
    inlineKeyForProvider.value = null
    inlineKeyValue.value = ''
    selectedProviderId.value = providerId
    selectedModelId.value = PROVIDER_CATALOG.find(p => p.id === providerId)?.defaultModel ?? ''
    emitChange()
    open.value = false
  } catch {
    // silently fail — user sees the input is still open
  } finally {
    savingKey.value = false
  }
}
</script>

<style scoped>
.fade-down-enter-active,
.fade-down-leave-active {
  transition: opacity 0.12s ease, transform 0.12s ease;
}
.fade-down-enter-from,
.fade-down-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
