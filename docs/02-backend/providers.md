# Providers

"Providers" are the external AI services (Claude, fal.ai, ElevenLabs, Runway, …). Each is wrapped in a small **adapter class** so handlers can stay provider-agnostic. Everything lives in `server/worker/providers/`.

## The three files that matter

### types.ts — the contracts

Four interfaces, one per media category. Every adapter implements exactly one:

```ts
interface ScriptProvider { providerId: string; generate(p: ScriptParams): Promise<ScriptResult> }
interface ImageProvider  { providerId: string; generate(p: ImageParams):  Promise<ImageResult> }
interface AudioProvider  { providerId: string; generate(p: AudioParams):  Promise<AudioResult> }
interface VideoProvider  { providerId: string; generate(p: VideoParams):  Promise<VideoResult> }
```

All params extend `ProviderParams { job, apiKey, model }`. Category-specific fields:

| Category | Extra params | Result |
|---|---|---|
| Script | `messages` (role/content list), `systemPrompt?`, `maxTokens?` | `{ text: string }` |
| Image | `prompt`, `negativePrompt?` | `{ imageUrl? }` **or** `{ rawBuffer?, mimeType? }` (Stability returns bytes; all others a URL) |
| Audio | `text`, `voiceId`, `speed?`, `stability?`, `similarityBoost?` | `{ audioBuffer: Buffer, mimeType }` — always bytes |
| Video | `prompt`, `imageUrl?` (first frame), `duration?` | `{ videoUrl? }` **or** `{ rawBuffer?, mimeType? }` (Veo & HuggingFace return bytes) |

Aspect ratio is deliberately **not** a parameter — every adapter hardcodes its provider's closest match to `VIDEO_FORMAT`'s 9:16 (e.g. fal uses `image_size: 'portrait_16_9'`, Runway uses `ratio: '720:1280'`).

### catalog.ts — UI metadata (single source of truth)

`PROVIDER_CATALOG: ProviderMeta[]` — one entry per provider the user can pick. Fields:

| Field | Meaning |
|---|---|
| `id` | Internal id, must match the registry key (e.g. `'fal'`, `'openai_tts'`) |
| `displayName` | Shown in dropdowns |
| `category` | `'script' \| 'image' \| 'audio' \| 'video'` |
| `defaultModel` / `models[]` | Model dropdown contents (`{ id, label }`) |
| `asyncPattern` | Documentation of how the API behaves: `sync` (one call), `polling` (create task, poll status), `queue` (fal's subscribe) — informational, not read by code logic |
| `keyProviderId` | **Key sharing.** If set, this provider authenticates with another provider's stored key. E.g. `veo`, `nanobanana`, `gemini_tts` → `'gemini'`; `huggingface_image/audio/video` → `'huggingface'`; `replicate_video` → `'replicate'`. Key lookups and key saving must always use `keyProviderId ?? id` |
| `keyDisplayName` | Label for the "paste your key" form |
| `dualCredentials` + `dualCredentialFields` | Providers needing two secrets (Kling: AK+SK, PlayHT: key+user id). Stored as one JSON string in `api_keys`; the adapter parses it |

Helper functions:
- `getCatalogByCategory(category)` → entries for one stage's dropdown.
- `getCatalogEntry(id)` → one entry or `undefined`.

The frontend imports all of this via the re-export shim `app/utils/providerCatalog.ts` (the catalog file has no server-only imports, so it's safe in the browser).

### registry.ts — implementation lookup

Four `Record<string, XProvider>` maps holding **one instance** of every adapter, plus:

```ts
providerRegistry.script(id) / .image(id) / .audio(id) / .video(id)
```

Each throws `Unknown <type> provider: "<id>". Check your project settings.` for unknown ids (surfaces as the job error).

## The adapter pattern (what an adapter looks like)

Adapters are small classes, one file each, in `providers/<category>/`. Example (`script/anthropic.ts`):

```ts
export class AnthropicScriptProvider implements ScriptProvider {
  readonly providerId = 'anthropic'
  async generate(params: ScriptParams): Promise<ScriptResult> {
    const client = new Anthropic({ apiKey: params.apiKey })   // client built per call — never global
    const message = await client.messages.create({ model: params.model, max_tokens: ..., system: ..., messages: ... })
    return { text: /* concatenated text blocks */ }
  }
}
```

Rules every adapter follows:

1. **Construct the SDK client per call** with `params.apiKey`. Never configure a module-global client — keys differ per user and jobs run interleaved. (fal's SDK is global-config-only; the adapter calls `fal.config()` immediately before each request as the closest safe approximation.)
2. **Throw on failure** with a descriptive message — the queue's retry/fail machinery handles the rest.
3. **Polling providers poll internally**: e.g. Runway creates a task then polls every 5 s up to 10 min inside `generate()`; the handler just awaits.
4. Return the minimal result shape; downloading URLs to bytes is the *handler's* job (except providers that only give bytes).

## Provider inventory

| Category | Registry id | Service | Notes |
|---|---|---|---|
| script | `anthropic` | Claude | default script provider |
| script | `openai` | GPT-4.1 family | |
| script | `gemini` | Google Gemini | key shared with veo/nanobanana/gemini_tts |
| script | `groq` | Llama on Groq | |
| script | `mistral` | Mistral | |
| script | `openrouter` | many models via OpenRouter | model ids are `vendor/model` |
| script | `huggingface` | HF Inference API | key shared with hf image/audio/video |
| image | `fal` | fal.ai FLUX | default image provider; queue-based SDK |
| image | `openai_image` | GPT Image | |
| image | `stability` | Stability AI | returns raw bytes |
| image | `ideogram` | Ideogram | |
| image | `together_image` | Together AI FLUX | |
| image | `nanobanana` | Google image models | uses `gemini` key |
| image | `replicate` | Replicate | polling |
| image | `huggingface_image` | HF | uses `huggingface` key |
| audio | `elevenlabs` | ElevenLabs TTS | default audio provider; supports stability/similarityBoost/speed |
| audio | `openai_tts` | OpenAI TTS | |
| audio | `playht` | PlayHT | dual credentials (key + user id) |
| audio | `cartesia` | Cartesia Sonic | |
| audio | `fish_audio` | Fish Audio | voice via reference_id |
| audio | `gemini_tts` | Gemini TTS | uses `gemini` key; 30 built-in voices |
| audio | `huggingface_audio` | HF TTS models | uses `huggingface` key |
| video | `runway` | Runway Gen-4 | default video provider; **requires** `imageUrl`; polls ≤10 min |
| video | `kling` | Kling | dual credentials (AK+SK, JWT-signed requests) |
| video | `luma` | Luma Ray-2 | |
| video | `minimax` | Hailuo/MiniMax | |
| video | `fal_video` | Pika via fal.ai | |
| video | `veo` | Google Veo | uses `gemini` key; returns raw bytes |
| video | `replicate_video` | Replicate video models | uses `replicate` key |
| video | `huggingface_video` | HF video models | uses `huggingface` key; returns raw bytes |

Every adapter has a matching mocked unit test in `tests/unit/providers/`.

## Adding a provider

Full step-by-step guide: [add-a-provider.md](../05-guides/add-a-provider.md). Short version: catalog entry → adapter file → registry entry → unit test.
