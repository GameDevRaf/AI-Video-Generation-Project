<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-50 flex justify-end"
      @click.self="$emit('close')"
    >
      <div class="w-80 h-full bg-gray-900 border-l border-white/10 flex flex-col shadow-2xl overflow-y-auto">
        <!-- Header -->
        <div class="flex items-center justify-between px-5 py-4 border-b border-white/10 shrink-0">
          <h2 class="text-sm font-semibold">API Keys</h2>
          <button class="text-gray-500 hover:text-white transition-colors" @click="$emit('close')">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 6 6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <!-- Keys list -->
        <div class="flex flex-col divide-y divide-white/8 flex-1">
          <div
            v-for="key in keys"
            :key="key.id"
            class="flex items-center justify-between px-5 py-3"
          >
            <div class="flex flex-col gap-0.5">
              <span class="text-sm text-gray-200">{{ displayName(key.provider) }}</span>
              <span class="text-xs text-gray-600">{{ key.key_name ?? 'Unnamed' }}</span>
            </div>
            <span class="text-xs text-green-400">✓ Active</span>
          </div>
          <div v-if="!keys.length" class="px-5 py-6 text-sm text-gray-600">
            No keys saved. Add them in
            <NuxtLink to="/settings" class="text-white hover:underline" @click="$emit('close')">Settings</NuxtLink>.
          </div>
        </div>

        <!-- Quick-add -->
        <div class="p-5 border-t border-white/10 flex flex-col gap-3 shrink-0">
          <p class="text-xs text-gray-500">Quick-add a key</p>
          <select
            v-model="quickProvider"
            class="w-full px-3 py-2 bg-gray-800 border border-white/10 rounded-lg text-sm text-white focus:outline-none"
          >
            <optgroup v-for="cat in CATEGORIES" :key="cat.id" :label="cat.label">
              <option v-for="p in providersByCategory(cat.id)" :key="p.id" :value="p.id">
                {{ p.displayName }}
              </option>
            </optgroup>
          </select>

          <!-- Dual-credential note -->
          <p v-if="selectedProviderMeta?.dualCredentials" class="text-xs text-amber-400/80 leading-snug">
            {{ dualCredentialNote }}
          </p>

          <input
            v-model="quickSecret"
            type="password"
            :placeholder="selectedProviderMeta?.dualCredentials ? 'Paste JSON credentials…' : 'Paste API key…'"
            class="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none font-mono"
          />
          <button
            :disabled="!quickSecret.trim() || saving"
            class="w-full py-2 bg-white text-gray-950 rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors disabled:opacity-40"
            @click="quickAdd"
          >
            {{ saving ? 'Saving…' : 'Save' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { PROVIDER_CATALOG, getCatalogByCategory } from '~/utils/providerCatalog'

defineProps<{ open: boolean }>()
defineEmits<{ close: [] }>()

const CATEGORIES = [
  { id: 'script' as const, label: 'Script (LLM)' },
  { id: 'image' as const, label: 'Image' },
  { id: 'audio' as const, label: 'Audio / TTS' },
  { id: 'video' as const, label: 'Video' },
]

function providersByCategory(cat: 'script' | 'image' | 'audio' | 'video') {
  return getCatalogByCategory(cat)
}

function displayName(providerId: string): string {
  return PROVIDER_CATALOG.find(p => p.id === providerId)?.displayName ?? providerId
}

const selectedProviderMeta = computed(() =>
  PROVIDER_CATALOG.find(p => p.id === quickProvider.value)
)

const dualCredentialNote = computed(() => {
  const meta = selectedProviderMeta.value
  if (!meta?.dualCredentials || !meta.dualCredentialFields) return ''
  return `Requires two fields. Store as JSON: {"${meta.dualCredentialFields[0].replace(/\s.*/,'').toLowerCase()}":"...","${meta.dualCredentialFields[1].replace(/\s.*/,'').toLowerCase()}":"..."}`
})

interface ApiKeyMeta {
  id: string
  provider: string
  key_name: string | null
  is_active: boolean
  created_at: string
}

const keys = ref<ApiKeyMeta[]>([])
const quickProvider = ref('elevenlabs')
const quickSecret = ref('')
const saving = ref(false)

onMounted(async () => {
  keys.value = await $fetch<ApiKeyMeta[]>('/api/provider/keys').catch(() => [])
})

async function quickAdd() {
  if (!quickSecret.value.trim()) return
  saving.value = true
  try {
    const created = await $fetch<ApiKeyMeta>('/api/provider/keys', {
      method: 'POST',
      body: { provider: quickProvider.value, secret: quickSecret.value.trim() },
    })
    keys.value.unshift(created)
    quickSecret.value = ''
  } finally {
    saving.value = false
  }
}
</script>
