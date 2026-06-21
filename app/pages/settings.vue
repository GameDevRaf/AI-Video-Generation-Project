<template>
  <div class="p-8 flex flex-col gap-10 max-w-2xl">
    <h1 class="text-xl font-semibold">Settings</h1>

    <!-- ── Generation behavior ── -->
    <section class="flex flex-col gap-5">
      <h2 class="text-sm font-medium text-gray-300 uppercase tracking-wider">Generation behavior</h2>

      <!-- Prompt edit mode -->
      <div class="flex items-start justify-between gap-8 py-4 border-b border-white/8">
        <div class="flex flex-col gap-1">
          <span class="text-sm text-gray-200">Prompt edit mode</span>
          <span class="text-xs text-gray-500">Controls when you can edit image/video prompts relative to generation.</span>
        </div>
        <div class="flex gap-1 p-1 bg-white/5 rounded-lg shrink-0">
          <button
            v-for="mode in promptModes"
            :key="mode.value"
            class="px-3 py-1.5 rounded-md text-xs font-medium transition-colors"
            :class="userSettings.prompt_edit_mode === mode.value
              ? 'bg-white text-gray-950'
              : 'text-gray-400 hover:text-white'"
            @click="save('prompt_edit_mode', mode.value)"
          >
            {{ mode.label }}
          </button>
        </div>
      </div>

      <!-- Default audio provider -->
      <div class="flex items-start justify-between gap-8 py-4 border-b border-white/8">
        <div class="flex flex-col gap-1">
          <span class="text-sm text-gray-200">Default audio provider</span>
          <span class="text-xs text-gray-500">Applied when starting a new audio generation.</span>
        </div>
        <select
          v-model="userSettings.default_audio_provider"
          class="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-white/20 shrink-0"
          @change="save('default_audio_provider', userSettings.default_audio_provider)"
        >
          <option value="elevenlabs">ElevenLabs</option>
          <option value="openai">OpenAI TTS</option>
        </select>
      </div>

      <!-- Default image model -->
      <div class="flex items-start justify-between gap-8 py-4 border-b border-white/8">
        <div class="flex flex-col gap-1">
          <span class="text-sm text-gray-200">Default image model</span>
          <span class="text-xs text-gray-500">e.g. <code class="bg-white/5 px-1 rounded">dall-e-3</code>, <code class="bg-white/5 px-1 rounded">stable-diffusion-xl</code></span>
        </div>
        <input
          v-model="userSettings.default_image_model"
          type="text"
          placeholder="dall-e-3"
          class="w-44 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-white/20 shrink-0"
          @blur="save('default_image_model', userSettings.default_image_model)"
        />
      </div>

      <!-- Default video model -->
      <div class="flex items-start justify-between gap-8 py-4 border-b border-white/8">
        <div class="flex flex-col gap-1">
          <span class="text-sm text-gray-200">Default video model</span>
          <span class="text-xs text-gray-500">e.g. <code class="bg-white/5 px-1 rounded">gen-3-alpha</code>, <code class="bg-white/5 px-1 rounded">kling-v1</code></span>
        </div>
        <input
          v-model="userSettings.default_video_model"
          type="text"
          placeholder="gen-3-alpha"
          class="w-44 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-white/20 shrink-0"
          @blur="save('default_video_model', userSettings.default_video_model)"
        />
      </div>
    </section>

    <!-- ── API Keys & Providers ── -->
    <section class="flex flex-col gap-5">
      <h2 class="text-sm font-medium text-gray-300 uppercase tracking-wider">API keys</h2>

      <!-- Existing keys -->
      <div v-if="keys.length" class="flex flex-col divide-y divide-white/8 rounded-xl border border-white/10 overflow-hidden">
        <div
          v-for="key in keys"
          :key="key.id"
          class="flex items-center justify-between px-4 py-3 bg-white/3"
        >
          <div class="flex flex-col gap-0.5">
            <span class="text-sm text-gray-200 capitalize">{{ key.provider }}</span>
            <span class="text-xs text-gray-500">{{ key.key_name ?? 'Unnamed key' }} · Added {{ relativeTime(key.created_at) }}</span>
          </div>
          <div class="flex items-center gap-3">
            <span
              class="text-xs px-2 py-0.5 rounded-full"
              :class="key.is_active ? 'bg-green-400/10 text-green-400' : 'bg-white/5 text-gray-500'"
            >
              {{ key.is_active ? 'Active' : 'Inactive' }}
            </span>
            <button
              class="text-xs text-gray-500 hover:text-red-400 transition-colors"
              @click="removeKey(key.id)"
            >
              Remove
            </button>
          </div>
        </div>
      </div>
      <p v-else class="text-sm text-gray-600">No API keys added yet.</p>

      <!-- Add key form -->
      <div class="flex flex-col gap-3 p-4 rounded-xl border border-white/10 bg-white/3">
        <h3 class="text-sm font-medium text-gray-300">Add API key</h3>
        <div class="grid grid-cols-2 gap-3">
          <div class="flex flex-col gap-1.5">
            <label class="text-xs text-gray-500">Provider</label>
            <select
              v-model="newKey.provider"
              class="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-1 focus:ring-white/20"
            >
              <option v-for="p in providers" :key="p.id" :value="p.id">{{ p.label }}</option>
            </select>
          </div>
          <div class="flex flex-col gap-1.5">
            <label class="text-xs text-gray-500">Label <span class="text-gray-600">(optional)</span></label>
            <input
              v-model="newKey.keyName"
              type="text"
              placeholder="My ElevenLabs key"
              class="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-white/20"
            />
          </div>
        </div>
        <div class="flex flex-col gap-1.5">
          <label class="text-xs text-gray-500">API key</label>
          <input
            v-model="newKey.secret"
            type="password"
            placeholder="sk-… or your key"
            class="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-white/20 font-mono"
          />
        </div>
        <p v-if="keyError" class="text-xs text-red-400">{{ keyError }}</p>
        <div class="flex justify-end">
          <button
            :disabled="!newKey.provider || !newKey.secret.trim() || savingKey"
            class="px-4 py-2 bg-white text-gray-950 rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors disabled:opacity-40"
            @click="addKey"
          >
            {{ savingKey ? 'Saving…' : 'Save key' }}
          </button>
        </div>
      </div>

      <p class="text-xs text-gray-600 leading-relaxed">
        Keys are encrypted at rest using AES-256-GCM. They are never sent to the client — only used server-side by the worker to call your providers.
      </p>
    </section>

    <!-- Save indicator -->
    <p v-if="savedMsg" class="fixed bottom-6 right-6 text-xs text-green-400 bg-gray-900 border border-green-400/20 px-4 py-2 rounded-full shadow-lg">
      {{ savedMsg }}
    </p>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'dashboard', middleware: 'auth' })

const promptModes = [
  { value: 'after_generation', label: 'Generate first' },
  { value: 'before_generation', label: 'Edit prompt first' },
]

const providers = [
  { id: 'anthropic', label: 'Anthropic (Claude)' },
  { id: 'elevenlabs', label: 'ElevenLabs' },
  { id: 'openai', label: 'OpenAI' },
  { id: 'stability', label: 'Stability AI' },
  { id: 'fal', label: 'fal.ai' },
  { id: 'runway', label: 'Runway' },
  { id: 'kling', label: 'Kling' },
  { id: 'suno', label: 'Suno' },
]

// ── User settings ──
interface UserSettings {
  prompt_edit_mode: string
  default_audio_provider: string
  default_audio_voice_id: string | null
  default_image_model: string | null
  default_video_model: string | null
  default_music_model: string | null
}

const userSettings = reactive<UserSettings>({
  prompt_edit_mode: 'after_generation',
  default_audio_provider: 'elevenlabs',
  default_audio_voice_id: null,
  default_image_model: null,
  default_video_model: null,
  default_music_model: null,
})

const savedMsg = ref('')
let saveTimer: ReturnType<typeof setTimeout>

onMounted(async () => {
  const data = await $fetch<UserSettings>('/api/settings').catch(() => null)
  if (data) Object.assign(userSettings, data)
})

async function save(field: keyof UserSettings, value: string | null) {
  await $fetch('/api/settings', { method: 'PATCH', body: { [field]: value } })
  clearTimeout(saveTimer)
  savedMsg.value = 'Saved'
  saveTimer = setTimeout(() => { savedMsg.value = '' }, 2000)
}

// ── API keys ──
interface ApiKeyMeta {
  id: string
  provider: string
  key_name: string | null
  is_active: boolean
  created_at: string
}

const keys = ref<ApiKeyMeta[]>([])
const newKey = reactive({ provider: 'elevenlabs', keyName: '', secret: '' })
const savingKey = ref(false)
const keyError = ref('')

onMounted(async () => {
  keys.value = await $fetch<ApiKeyMeta[]>('/api/provider/keys').catch(() => [])
})

async function addKey() {
  if (!newKey.provider || !newKey.secret.trim()) return
  savingKey.value = true
  keyError.value = ''
  try {
    const created = await $fetch<ApiKeyMeta>('/api/provider/keys', {
      method: 'POST',
      body: { provider: newKey.provider, secret: newKey.secret.trim(), keyName: newKey.keyName || undefined },
    })
    keys.value.unshift(created)
    newKey.secret = ''
    newKey.keyName = ''
  } catch (e) {
    keyError.value = e instanceof Error ? e.message : 'Failed to save key'
  } finally {
    savingKey.value = false
  }
}

async function removeKey(id: string) {
  if (!confirm('Remove this API key?')) return
  await $fetch(`/api/provider/keys/${id}`, { method: 'DELETE' })
  keys.value = keys.value.filter(k => k.id !== id)
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const days = Math.floor(diff / 86400000)
  if (days < 1) return 'today'
  if (days === 1) return 'yesterday'
  return `${days}d ago`
}
</script>
