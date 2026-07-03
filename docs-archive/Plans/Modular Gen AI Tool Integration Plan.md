# Provider Abstraction Layer — AI Video Generation SaaS

## Context

The worker handlers for image, audio, and video are stubs that fail immediately with "provider not configured". The script handler hard-codes Anthropic. The goal is to wire real provider APIs behind a clean abstraction so every generation type has 5–7 interchangeable providers, the user can switch providers per project via the workspace top-right button, and API keys are managed in Settings and the Provider Panel.

---

## 1. DB Migration — `supabase/migrations/004_provider_columns.sql`

Apply in Supabase SQL Editor after 003.

```sql
ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS default_script_provider  text NOT NULL DEFAULT 'anthropic',
  ADD COLUMN IF NOT EXISTS default_image_provider   text NOT NULL DEFAULT 'fal',
  ADD COLUMN IF NOT EXISTS default_video_provider   text NOT NULL DEFAULT 'runway',
  ADD COLUMN IF NOT EXISTS default_audio_model      text;

ALTER TABLE public.project_settings
  ADD COLUMN IF NOT EXISTS default_script_provider  text,
  ADD COLUMN IF NOT EXISTS default_image_provider   text,
  ADD COLUMN IF NOT EXISTS default_audio_provider   text,
  ADD COLUMN IF NOT EXISTS default_video_provider   text;
```

`project_settings` columns are nullable — `NULL` means "inherit from user_settings".

---

## 2. Provider Catalog

### Script (LLM)
| Provider ID | Display Name | npm Package | Default Model |
|---|---|---|---|
| `anthropic` | Claude | `@anthropic-ai/sdk` (existing) | `claude-sonnet-4-6` |
| `openai` | OpenAI GPT | `openai` | `gpt-4.1` |
| `gemini` | Google Gemini | `@google/genai` | `gemini-2.5-flash` |
| `groq` | Groq | `groq-sdk` | `llama-3.3-70b-versatile` |
| `mistral` | Mistral | `@mistralai/mistralai` | `mistral-large-latest` |

### Image
| Provider ID | Display Name | npm Package | Default Model | Async Pattern |
|---|---|---|---|---|
| `fal` | fal.ai (FLUX) | `@fal-ai/client` | `fal-ai/flux-pro/v1.1` | queue (subscribe) |
| `openai_image` | OpenAI Images | `openai` | `gpt-image-2` | sync |
| `stability` | Stability AI | fetch only | `stable-image-core` | sync (raw bytes) |
| `ideogram` | Ideogram v3 | fetch only | `V_3` | sync |
| `together_image` | Together AI | `together-ai` | `black-forest-labs/FLUX.2-dev` | sync |

### Audio / TTS
| Provider ID | Display Name | npm Package | Default Model |
|---|---|---|---|
| `elevenlabs` | ElevenLabs | `@elevenlabs/elevenlabs-js` | `eleven_multilingual_v2` |
| `openai_tts` | OpenAI TTS | `openai` | `tts-1` |
| `playht` | PlayHT | fetch only | `PlayDialog` |
| `cartesia` | Cartesia | fetch only | `sonic-2` |

> **PlayHT:** requires two credentials (`apiKey` + `userId`). Store as `JSON.stringify({apiKey,userId})`.

### Video
| Provider ID | Display Name | npm Package | Default Model | Async Pattern |
|---|---|---|---|---|
| `runway` | Runway | `@runwayml/sdk` | `gen4_turbo` | polling (SDK handles) |
| `kling` | Kling AI | fetch + `jose` | `kling-v2-master` | polling (10s intervals) |
| `luma` | Luma Ray-2 | `lumaai` | `ray-2` | polling (3s intervals) |
| `minimax` | Hailuo / MiniMax | fetch only | `MiniMax-Hailuo-02` | polling (10s intervals) |
| `fal_video` | Pika via fal.ai | `@fal-ai/client` | `fal-ai/pika-ai/pikav2.2` | queue |

> **Kling:** requires two credentials (`ak` + `sk`) for JWT auth. Store as `JSON.stringify({ak,sk})`.

---

## 3. Packages to Install

```
bun add openai @google/genai groq-sdk @mistralai/mistralai \
        @fal-ai/client together-ai \
        @elevenlabs/elevenlabs-js \
        @runwayml/sdk lumaai jose
```

`@anthropic-ai/sdk` is already installed.

---

## 4. File Structure

### New files to create

```
server/worker/providers/
  types.ts              ← interfaces: ScriptProvider, ImageProvider, AudioProvider, VideoProvider
  catalog.ts            ← PROVIDER_CATALOG static array (also re-exported via app/utils/providerCatalog.ts)
  registry.ts           ← providerRegistry.script/image/audio/video(id) → provider instance

server/worker/providers/script/
  anthropic.ts  openai.ts  gemini.ts  groq.ts  mistral.ts

server/worker/providers/image/
  fal.ts  openai_image.ts  stability.ts  ideogram.ts  together_image.ts

server/worker/providers/audio/
  elevenlabs.ts  openai_tts.ts  playht.ts  cartesia.ts

server/worker/providers/video/
  runway.ts  kling.ts  luma.ts  minimax.ts  fal_video.ts

server/worker/lib/
  getProviderKey.ts     ← queries api_keys table, decrypts via existing server/utils/crypto.ts

app/utils/
  providerCatalog.ts    ← re-exports PROVIDER_CATALOG for use in Vue components

app/components/workspace/
  ModelSelector.vue     ← NEW: replaces static stage label in workspace #model-selector slot

supabase/migrations/
  004_provider_columns.sql
```

### Existing files to modify

```
server/worker/handlers/script.ts   → use registry (Anthropic default, no behavior change)
server/worker/handlers/image.ts    → full implementation via registry
server/worker/handlers/audio.ts    → full implementation via registry
server/worker/handlers/video.ts    → full implementation via registry
app/types/database.types.ts        → extend DbProjectSettings; add DbUserSettings interface
app/components/workspace/ProviderPanel.vue → expand provider list to all ~15 providers
app/pages/settings.vue             → replace free-text model inputs with structured dropdowns
app/pages/workspace/[projectId].vue → swap static label for <WorkspaceModelSelector>
server/api/settings/index.patch.ts → accept new provider columns in body
```

---

## 5. Core Interfaces (`server/worker/providers/types.ts`)

```typescript
export interface ProviderParams { job: DbJob; apiKey: string; model: string }

export interface ScriptParams extends ProviderParams {
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
  systemPrompt?: string; maxTokens?: number
}
export interface ScriptResult { text: string }
export interface ScriptProvider { readonly providerId: string; generate(p: ScriptParams): Promise<ScriptResult> }

export interface ImageParams extends ProviderParams {
  prompt: string; negativePrompt?: string; aspectRatio?: string
}
// rawBuffer: Stability returns raw bytes, not a URL
export interface ImageResult { imageUrl?: string; rawBuffer?: Buffer; mimeType?: string }
export interface ImageProvider { readonly providerId: string; generate(p: ImageParams): Promise<ImageResult> }

export interface AudioParams extends ProviderParams {
  text: string; voiceId: string; speed?: number
}
export interface AudioResult { audioBuffer: Buffer; mimeType: string }
export interface AudioProvider { readonly providerId: string; generate(p: AudioParams): Promise<AudioResult> }

export interface VideoParams extends ProviderParams {
  prompt: string; imageUrl?: string; duration?: number; aspectRatio?: string
}
export interface VideoResult { videoUrl: string }
export interface VideoProvider { readonly providerId: string; generate(p: VideoParams): Promise<VideoResult> }
```

---

## 6. `getProviderKey.ts` Helper

```typescript
// server/worker/lib/getProviderKey.ts
import { adminSupabase } from './supabase'
import { decrypt } from '../../utils/crypto'

export async function getProviderKey(provider: string, userId: string): Promise<string> {
  const { data, error } = await adminSupabase
    .from('api_keys')
    .select('encrypted_secret')
    .eq('user_id', userId).eq('provider', provider).eq('is_active', true)
    .order('created_at', { ascending: false }).limit(1).single()
  if (error || !data) throw new Error(`No active API key for "${provider}". Add one in Settings.`)
  return decrypt(data.encrypted_secret)
}
```

---

## 7. Updated Handler Pattern (all three stubs follow this)

```typescript
// server/worker/handlers/image.ts (full implementation)
export async function handleImageJob(job: DbJob) {
  const input = job.input as { scene_id: string; prompt: string; provider?: string; model?: string }
  const providerId = input.provider ?? job.provider ?? 'fal'

  await updateJobStatus(job.id, 'waiting_on_provider', {})
  const apiKey = await getProviderKey(providerId, job.user_id)
  const provider = providerRegistry.image(providerId)
  const defaultModel = PROVIDER_CATALOG.find(p => p.id === providerId)!.defaultModel
  const result = await provider.generate({
    job, apiKey, model: input.model ?? job.model ?? defaultModel,
    prompt: input.prompt,
  })

  // Stability returns rawBuffer; all others return imageUrl → download
  const { buffer, mime } = result.rawBuffer
    ? { buffer: result.rawBuffer, mime: result.mimeType ?? 'image/png' }
    : await fetch(result.imageUrl!).then(async r => ({
        buffer: Buffer.from(await r.arrayBuffer()),
        mime: r.headers.get('content-type') ?? 'image/png',
      }))

  const ext = mime.split('/')[1] ?? 'png'
  const storagePath = `${job.project_id}/images/${input.scene_id}_${Date.now()}.${ext}`
  await storeFileOutput(job, buffer, storagePath, 'image', `scene_image_${input.scene_id}`, mime)
  await updateJobStatus(job.id, 'completed', {
    completed_at: new Date().toISOString(),
    output_summary: { scene_id: input.scene_id, provider: providerId },
  })
}
```

`audio.ts` and `video.ts` follow identically — audio calls `storeFileOutput` with type `'audio'`, video downloads the returned URL and stores with type `'video'`.

`script.ts` refactored: reads `input.provider ?? 'anthropic'`, calls `providerRegistry.script(id).generate({ job, apiKey, model, messages, systemPrompt })`. Anthropic provider wraps existing logic → identical outputs.

---

## 8. Provider Implementation Notes

### fal.ai (image + video)
Call `fal.config({ credentials: apiKey })` **inside** `generate()` on every call — NOT at module level — to avoid credential leakage between concurrent jobs. Use `fal.subscribe(model, { input })` which handles queue + polling internally.

### Stability AI
`POST https://api.stability.ai/v2beta/stable-image/generate/core` with `Accept: image/*` + multipart body (`prompt`, `output_format: png`, `aspect_ratio: 16:9`). Response is raw image bytes — return as `{ rawBuffer }` (no URL step needed).

### Ideogram v3
`POST https://api.ideogram.ai/v1/ideogram-v3/generate` with `Api-Key` header + multipart `(prompt, rendering_speed: DEFAULT, aspect_ratio: 16X9)`. Result at `json.data[0].url`.

### Kling AI
Credentials as `JSON.stringify({ ak, sk })`. Generate HS256 JWT with `jose`:
```typescript
import { SignJWT } from 'jose'
const token = await new SignJWT({ iss: ak })
  .setProtectedHeader({ alg: 'HS256' })
  .setExpirationTime('30m').setNotBefore('-5s')
  .sign(new TextEncoder().encode(sk))
```
Submit: `POST https://api.klingai.com/v1/videos/image2video`. Poll: `GET /v1/videos/image2video/{task_id}` every 10s. Re-generate JWT inside polling loop (30-min token lifetime). `task_result.videos[0].url` is the result.

### Runway
`@runwayml/sdk`: `client.imageToVideo.create({ model: 'gen4_turbo', promptImage: imageUrl, promptText, ratio: '1280:720', duration })` → `client.tasks.waitForTaskOutput(task.id)` (SDK polls internally) → `output[0]` is the video URL.

### Luma
`lumaai`: `client.generations.create({ model: 'ray-2', prompt, resolution: '720p', duration: '5s', keyframes: { frame0: { type: 'image', url: imageUrl } } })` → poll `client.generations.get(gen.id)` every 3s until `state === 'completed'` → `gen.assets.video`.

### MiniMax / Hailuo
`POST https://api.minimax.io/v1/video_generation` → poll `GET /v1/query/video_generation?task_id=...` every 10s → when `Success`, call `GET /v1/files/retrieve?file_id=...` → `file.download_url`.

### PlayHT
Two credentials stored as `JSON.stringify({ apiKey, userId })`. `POST https://api.play.ht/api/v2/tts/stream` with headers `Authorization: Bearer {apiKey}`, `X-User-Id: {userId}`. Response body is MP3 stream → `Buffer.from(await res.arrayBuffer())`.

### Cartesia
`POST https://api.cartesia.ai/tts/bytes` with header `Cartesia-Version: 2025-04-16`, body `{ transcript, model_id, voice: { mode: 'id', id: voiceId }, output_format: { container: 'wav', encoding: 'pcm_f32le', sample_rate: 44100 } }`. Response is raw WAV bytes.

### Gemini
`@google/genai` (NOT the deprecated `@google/generative-ai`):
```typescript
import { GoogleGenAI } from '@google/genai'
const ai = new GoogleGenAI({ apiKey: params.apiKey })
const res = await ai.models.generateContent({ model: params.model, contents: [...], config: { systemInstruction: params.systemPrompt } })
return { text: res.text ?? '' }
```

### Groq
`groq-sdk` is OpenAI-compat: `new Groq({ apiKey })` → `client.chat.completions.create({ model, messages })`.

### Mistral
`@mistralai/mistralai`: `new Mistral({ apiKey })` → `client.chat.complete({ model, messages })`.

---

## 9. ModelSelector.vue Component

**Props:** `stage: 'script' | 'image' | 'audio' | 'video'`, `savedProviderIds: string[]`

**Emits:** `provider-changed(providerId: string, modelId: string)`, `open-key-panel()`

**Behavior:**
1. Shows pill button: `[stage icon] [Provider Name] / [Model Name] [▼]`
2. Click → dropdown with all providers for `stage` from `PROVIDER_CATALOG`
3. Each row: name, model name, `✓ key saved` OR `+ key needed` badge
4. Click row with saved key → emit `provider-changed`, close dropdown
5. Click row without key → show inline `<input type="password">` + Save button → `POST /api/provider/keys` → emit `provider-changed`
6. Uses `data-testid="model-selector"` and `data-testid="provider-option-{id}"` for E2E

**Integration in `[projectId].vue`** — replace the `<template #model-selector>` div with:
```html
<WorkspaceModelSelector
  :stage="projectStore.currentStage"
  :saved-provider-ids="savedProviderIds"
  @provider-changed="onProviderChanged"
  @open-key-panel="providerPanelOpen = true"
/>
```

Add `const savedProviderIds = ref<string[]>([])` and populate from `GET /api/provider/keys` on mount (map to `keys.map(k => k.provider)`).

`onProviderChanged(id, model)` calls `projectStore.updateSettings({ [`default_${stage}_provider`]: id, [`default_${stage}_model`]: model })`.

---

## 10. Settings Page Updates

Replace the two free-text model inputs and the two-option audio select with four structured rows (one per generation type):

Each row pattern:
```html
<!-- Provider select -->
<select v-model="userSettings.default_image_provider" @change="onImageProviderChange">
  <option v-for="p in imageProviders" :key="p.id" :value="p.id">{{ p.displayName }}</option>
</select>
<!-- Model sub-select, populated from selectedProvider.models -->
<select v-model="userSettings.default_image_model" @change="save('default_image_model', ...)">
  <option v-for="m in currentImageModels" :key="m.id" :value="m.id">{{ m.label }}</option>
</select>
```

New "Script AI provider" row at the top of Generation behavior section.

Expand the **API keys** provider `<select>` to all providers from `PROVIDER_CATALOG`. For PlayHT and Kling, show a second credential field when those providers are selected, with a helper note about JSON storage format.

---

## 11. Test Plan

### Unit Tests (`tests/unit/providers/`) — `// @vitest-environment node`

One file per adapter. Mock HTTP calls with `vi.stubGlobal('fetch', vi.fn())` or `vi.mock('package-name')`.

| File | Mock | Key assertions |
|---|---|---|
| `fal.image.test.ts` | `vi.mock('@fal-ai/client')` | correct model/prompt forwarded; `imageUrl` returned |
| `stability.image.test.ts` | `vi.stubGlobal('fetch', ...)` | `Authorization: Bearer` header; `rawBuffer` in result |
| `ideogram.image.test.ts` | `vi.stubGlobal('fetch', ...)` | `Api-Key` header; `imageUrl` from `data[0].url` |
| `together_image.test.ts` | `vi.mock('together-ai')` | model forwarded; `imageUrl` returned |
| `elevenlabs.audio.test.ts` | `vi.mock('@elevenlabs/elevenlabs-js')` | voiceId + modelId forwarded; Buffer returned |
| `openai_tts.audio.test.ts` | `vi.mock('openai')` | `audio.speech.create` called; Buffer returned |
| `cartesia.audio.test.ts` | `vi.stubGlobal('fetch', ...)` | `Cartesia-Version` header; WAV buffer returned |
| `playht.audio.test.ts` | `vi.stubGlobal('fetch', ...)` | `X-User-Id` header; JSON credential parsing |
| `runway.video.test.ts` | `vi.mock('@runwayml/sdk')` | `imageToVideo.create` + `waitForTaskOutput` called; URL returned |
| `kling.video.test.ts` | `vi.stubGlobal('fetch', ...)` | JWT `Authorization` header; poll loop resolves; URL returned |
| `luma.video.test.ts` | `vi.mock('lumaai')` | `generations.create` + poll `get()` until `completed` |
| `minimax.video.test.ts` | `vi.stubGlobal('fetch', ...)` | 3-step flow (create → poll → file retrieve) |
| `openai.script.test.ts` | `vi.mock('openai')` | system prompt prepended; model forwarded; text returned |
| `getProviderKey.test.ts` | mock `adminSupabase` + `decrypt` | throws on missing row; returns decrypted string |

### Integration Tests (`tests/integration/worker/`) — `// @vitest-environment node`

Mirrors `script.handler.test.ts` — mock `providerRegistry`, `getProviderKey`, and jobs lib.

| File | Key assertions |
|---|---|
| `image.handler.test.ts` | `getProviderKey(providerId, userId)` called; `storeFileOutput` called with `'image'` type; job marked `completed`; on provider throw → job marked `failed` |
| `audio.handler.test.ts` | `storeFileOutput` with `'audio'`; buffer from provider passed through |
| `video.handler.test.ts` | Status: `queued` → `waiting_on_provider` → `completed`; `storeFileOutput` with `'video'` |

### E2E Tests (`tests/e2e/model-selector.spec.ts`) — Playwright

```
test: ModelSelector renders provider dropdown for current stage
test: Selecting provider with saved key updates project settings and closes dropdown
test: Selecting provider with no saved key shows inline key input
test: Settings page provider+model selects save and restore on reload
```

Use `page.route('/api/provider/keys', ...)` to stub key responses without needing real auth.

---

## 12. Implementation Sequence

1. Run migration 004 (user applies SQL)
2. `bun add` all new packages
3. `server/worker/providers/types.ts` + `catalog.ts`
4. `server/worker/lib/getProviderKey.ts`
5. All 5 script providers → `registry.ts` script section → refactor `handlers/script.ts`
6. All 5 image providers → `handlers/image.ts`
7. All 4 audio providers → `handlers/audio.ts`
8. All 5 video providers → `handlers/video.ts`
9. `app/utils/providerCatalog.ts` (re-export for Vue)
10. Extend `app/types/database.types.ts`
11. `ModelSelector.vue` + update `[projectId].vue`
12. Update `settings.vue` with structured provider dropdowns
13. Update `ProviderPanel.vue` with full provider list
14. All unit tests → integration tests → E2E test

---

## Verification

- `bun run test` → all 60+ unit/integration tests pass
- `bun run test:e2e` → model-selector spec passes
- Worker smoke test: start worker, create an `image` job with `input.provider: 'fal'` (with fal.ai key in DB) → verify `storeFileOutput` is called and job reaches `completed`
- Settings page: switch image provider to `stability` in UI → verify PATCH `/api/settings` persists the value; reload page → selection restored
