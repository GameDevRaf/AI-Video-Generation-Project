export interface ProviderModel {
  id: string
  label: string
}

export interface ProviderMeta {
  id: string
  displayName: string
  category: 'script' | 'image' | 'audio' | 'video'
  defaultModel: string
  models: ProviderModel[]
  asyncPattern: 'sync' | 'polling' | 'queue'
  /** Provider IDs that require two credentials stored as JSON (e.g. kling, playht) */
  dualCredentials?: boolean
  dualCredentialFields?: [string, string]
  /**
   * When set, this provider shares an API key with another provider.
   * The key lookup and inline-key storage both use this ID instead of `id`.
   * E.g. nanobanana, veo, gemini_tts all use the 'gemini' key.
   */
  keyProviderId?: string
  /** Display name shown in the "Paste your X API key" inline form. Defaults to displayName. */
  keyDisplayName?: string
}

export const PROVIDER_CATALOG: ProviderMeta[] = [
  // ── Script ───────────────────────────────────────────────
  {
    id: 'anthropic', displayName: 'Claude', category: 'script',
    defaultModel: 'claude-sonnet-4-6', asyncPattern: 'sync',
    models: [
      { id: 'claude-opus-4-8', label: 'Claude Opus 4.8' },
      { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
      { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5' },
    ],
  },
  {
    id: 'openai', displayName: 'OpenAI GPT', category: 'script',
    defaultModel: 'gpt-4.1', asyncPattern: 'sync',
    models: [
      { id: 'gpt-4.1', label: 'GPT-4.1' },
      { id: 'gpt-4o', label: 'GPT-4o' },
      { id: 'gpt-4.1-mini', label: 'GPT-4.1 Mini' },
    ],
  },
  {
    id: 'gemini', displayName: 'Google Gemini', category: 'script',
    defaultModel: 'gemini-2.5-flash', asyncPattern: 'sync',
    models: [
      { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
      { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
      { id: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite' },
      { id: 'gemini-3-flash', label: 'Gemini 3 Flash' },
      { id: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash Lite' },
      { id: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash' },
      { id: 'gemma-4-31b-it', label: 'Gemma 4 31B' },
      { id: 'gemma-4-26b-a4b-it', label: 'Gemma 4 26B' },
    ],
  },
  {
    id: 'groq', displayName: 'Groq', category: 'script',
    defaultModel: 'llama-3.3-70b-versatile', asyncPattern: 'sync',
    models: [
      { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B' },
      { id: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B (fast)' },
    ],
  },
  {
    id: 'mistral', displayName: 'Mistral', category: 'script',
    defaultModel: 'mistral-large-latest', asyncPattern: 'sync',
    models: [
      { id: 'mistral-large-latest', label: 'Mistral Large' },
      { id: 'mistral-small-latest', label: 'Mistral Small' },
    ],
  },
  {
    id: 'openrouter', displayName: 'OpenRouter', category: 'script',
    defaultModel: 'openai/gpt-4o-mini', asyncPattern: 'sync',
    models: [
      { id: 'openai/gpt-4o-mini', label: 'GPT-4o Mini' },
      { id: 'openai/gpt-4.1', label: 'GPT-4.1' },
      { id: 'anthropic/claude-sonnet-4', label: 'Claude Sonnet 4' },
      { id: 'google/gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
      { id: 'meta-llama/llama-3.3-70b-instruct', label: 'Llama 3.3 70B' },
      { id: 'deepseek/deepseek-chat', label: 'DeepSeek Chat' },
    ],
  },
  {
    id: 'huggingface', displayName: 'Hugging Face', category: 'script',
    defaultModel: 'deepseek-ai/DeepSeek-V3', asyncPattern: 'sync',
    keyDisplayName: 'Hugging Face Token',
    models: [
      { id: 'deepseek-ai/DeepSeek-V3', label: 'DeepSeek V3' },
      { id: 'meta-llama/Llama-3.3-70B-Instruct', label: 'Llama 3.3 70B' },
      { id: 'mistralai/Mistral-7B-Instruct-v0.3', label: 'Mistral 7B' },
      { id: 'Qwen/Qwen2.5-72B-Instruct', label: 'Qwen 2.5 72B' },
    ],
  },

  // ── Image ────────────────────────────────────────────────
  {
    id: 'fal', displayName: 'fal.ai (FLUX)', category: 'image',
    defaultModel: 'fal-ai/flux-pro/v1.1', asyncPattern: 'queue',
    models: [
      { id: 'fal-ai/flux-pro/v1.1', label: 'FLUX Pro 1.1' },
      { id: 'fal-ai/flux/schnell', label: 'FLUX Schnell (fast)' },
      { id: 'fal-ai/flux/dev', label: 'FLUX Dev' },
    ],
  },
  {
    id: 'openai_image', displayName: 'OpenAI Images', category: 'image',
    defaultModel: 'gpt-image-2', asyncPattern: 'sync',
    models: [
      { id: 'gpt-image-2', label: 'GPT Image 2' },
    ],
  },
  {
    id: 'stability', displayName: 'Stability AI', category: 'image',
    defaultModel: 'stable-image-core', asyncPattern: 'sync',
    models: [
      { id: 'stable-image-core', label: 'Stable Image Core' },
      { id: 'stable-diffusion-3-5-large', label: 'SD 3.5 Large' },
    ],
  },
  {
    id: 'ideogram', displayName: 'Ideogram v3', category: 'image',
    defaultModel: 'V_3', asyncPattern: 'sync',
    // V2 is served by a separate legacy endpoint (api.ideogram.ai/generate, JSON body,
    // ASPECT_10_16-style ratio enum) with no model field on the v3 endpoint the adapter
    // calls — not selectable here until a second adapter path is built for it.
    models: [
      { id: 'V_3', label: 'Ideogram v3' },
    ],
  },
  {
    id: 'together_image', displayName: 'Together AI', category: 'image',
    defaultModel: 'black-forest-labs/FLUX.2-dev', asyncPattern: 'sync',
    models: [
      { id: 'black-forest-labs/FLUX.2-dev', label: 'FLUX.2 Dev' },
      { id: 'black-forest-labs/FLUX.1-schnell', label: 'FLUX.1 Schnell' },
    ],
  },
  {
    id: 'nanobanana', displayName: 'Nano Banana (Google)', category: 'image',
    defaultModel: 'gemini-3.1-flash-image', asyncPattern: 'sync',
    keyProviderId: 'gemini',
    keyDisplayName: 'Google AI Studio / Gemini',
    models: [
      { id: 'gemini-3.1-flash-image', label: 'Nano Banana 2 (3.1 Flash)' },
      { id: 'gemini-3-pro-image', label: 'Nano Banana Pro' },
      { id: 'gemini-2.5-flash-image', label: 'Nano Banana (2.5 Flash)' },
    ],
  },
  {
    id: 'replicate', displayName: 'Replicate', category: 'image',
    defaultModel: 'black-forest-labs/flux-schnell', asyncPattern: 'polling',
    models: [
      { id: 'black-forest-labs/flux-schnell', label: 'FLUX Schnell (fast)' },
      { id: 'black-forest-labs/flux-1.1-pro', label: 'FLUX 1.1 Pro' },
      { id: 'stability-ai/stable-diffusion-3.5-large', label: 'SD 3.5 Large' },
      { id: 'recraft-ai/recraft-v3', label: 'Recraft v3' },
    ],
  },
  {
    id: 'huggingface_image', displayName: 'Hugging Face', category: 'image',
    defaultModel: 'black-forest-labs/FLUX.1-schnell', asyncPattern: 'sync',
    keyProviderId: 'huggingface',
    keyDisplayName: 'Hugging Face Token',
    models: [
      { id: 'black-forest-labs/FLUX.1-schnell', label: 'FLUX.1 Schnell' },
      { id: 'black-forest-labs/FLUX.1-dev', label: 'FLUX.1 Dev' },
      { id: 'stabilityai/stable-diffusion-xl-base-1.0', label: 'SDXL Base 1.0' },
      { id: 'ByteDance/Hyper-SD', label: 'Hyper-SD (ByteDance)' },
    ],
  },

  // ── Audio ────────────────────────────────────────────────
  {
    id: 'elevenlabs', displayName: 'ElevenLabs', category: 'audio',
    defaultModel: 'eleven_multilingual_v2', asyncPattern: 'sync',
    models: [
      { id: 'eleven_multilingual_v2', label: 'Multilingual v2' },
      { id: 'eleven_flash_v2_5', label: 'Flash v2.5 (fast)' },
      { id: 'eleven_v3', label: 'v3 (expressive)' },
    ],
  },
  {
    id: 'openai_tts', displayName: 'OpenAI TTS', category: 'audio',
    defaultModel: 'tts-1', asyncPattern: 'sync',
    models: [
      { id: 'tts-1', label: 'TTS-1' },
      { id: 'tts-1-hd', label: 'TTS-1 HD' },
    ],
  },
  {
    id: 'playht', displayName: 'PlayHT', category: 'audio',
    defaultModel: 'PlayDialog', asyncPattern: 'sync',
    dualCredentials: true,
    dualCredentialFields: ['API Key', 'User ID'],
    models: [
      { id: 'PlayDialog', label: 'PlayDialog' },
      { id: 'Play3.0-mini', label: 'Play 3.0 Mini (fast)' },
    ],
  },
  {
    id: 'cartesia', displayName: 'Cartesia', category: 'audio',
    defaultModel: 'sonic-2', asyncPattern: 'sync',
    models: [
      { id: 'sonic-2', label: 'Sonic 2' },
      { id: 'sonic-3', label: 'Sonic 3' },
    ],
  },
  {
    id: 'fish_audio', displayName: 'Fish Audio', category: 'audio',
    defaultModel: 's2-pro', asyncPattern: 'sync',
    models: [
      { id: 's2-pro', label: 'S2 Pro (expressive)' },
      { id: 's1', label: 'S1 (fast)' },
    ],
  },
  {
    id: 'gemini_tts', displayName: 'Gemini TTS (Google)', category: 'audio',
    defaultModel: 'gemini-2.5-flash-preview-tts', asyncPattern: 'sync',
    keyProviderId: 'gemini',
    keyDisplayName: 'Google AI Studio / Gemini',
    models: [
      { id: 'gemini-2.5-flash-preview-tts', label: 'Gemini 2.5 Flash TTS' },
      { id: 'gemini-2.5-pro-preview-tts', label: 'Gemini 2.5 Pro TTS' },
      { id: 'gemini-3.1-flash-tts-preview', label: 'Gemini 3.1 Flash TTS' },
    ],
  },
  {
    id: 'huggingface_audio', displayName: 'Hugging Face', category: 'audio',
    defaultModel: 'facebook/mms-tts-eng', asyncPattern: 'sync',
    keyProviderId: 'huggingface',
    keyDisplayName: 'Hugging Face Token',
    models: [
      { id: 'facebook/mms-tts-eng', label: 'MMS TTS (Facebook)' },
      { id: 'suno/bark', label: 'Bark (Suno)' },
      { id: 'microsoft/speecht5_tts', label: 'SpeechT5 (Microsoft)' },
    ],
  },

  // ── Video ────────────────────────────────────────────────
  {
    id: 'runway', displayName: 'Runway', category: 'video',
    defaultModel: 'gen4_turbo', asyncPattern: 'polling',
    models: [
      { id: 'gen4_turbo', label: 'Gen-4 Turbo' },
      { id: 'gen4', label: 'Gen-4' },
    ],
  },
  {
    id: 'kling', displayName: 'Kling AI', category: 'video',
    defaultModel: 'kling-v2-master', asyncPattern: 'polling',
    dualCredentials: true,
    dualCredentialFields: ['Access Key (AK)', 'Secret Key (SK)'],
    // "pro" is a separate `mode` request param, not part of model_name — kling-v1-pro/
    // kling-v1-5-pro are not valid model_name values.
    models: [
      { id: 'kling-v2-master', label: 'Kling v2 Master' },
      { id: 'kling-v2-6', label: 'Kling v2.6' },
      { id: 'kling-v1-6', label: 'Kling v1.6' },
    ],
  },
  {
    id: 'luma', displayName: 'Luma (Ray-2)', category: 'video',
    defaultModel: 'ray-2', asyncPattern: 'polling',
    models: [
      { id: 'ray-2', label: 'Ray 2' },
      { id: 'ray-flash-2', label: 'Ray Flash 2 (fast)' },
    ],
  },
  {
    id: 'minimax', displayName: 'Hailuo / MiniMax', category: 'video',
    defaultModel: 'MiniMax-Hailuo-02', asyncPattern: 'polling',
    models: [
      { id: 'MiniMax-Hailuo-02', label: 'Hailuo 02' },
      { id: 'MiniMax-Hailuo-2.3', label: 'Hailuo 2.3' },
    ],
  },
  {
    id: 'fal_video', displayName: 'Pika (via fal.ai)', category: 'video',
    // Base ids only — the adapter maps each to its real text-to-video/image-to-video
    // endpoint slug pair (fal has no single uniform suffix convention across models).
    defaultModel: 'fal-ai/pika/v2.2', asyncPattern: 'queue',
    models: [
      { id: 'fal-ai/pika/v2.2', label: 'Pika v2.2' },
      { id: 'fal-ai/minimax/video-01', label: 'MiniMax Video 01' },
    ],
  },
  {
    id: 'veo', displayName: 'Veo (Google)', category: 'video',
    defaultModel: 'veo-3.1-generate-preview', asyncPattern: 'polling',
    keyProviderId: 'gemini',
    keyDisplayName: 'Google AI Studio / Gemini',
    models: [
      { id: 'veo-3.1-generate-preview', label: 'Veo 3.1' },
      { id: 'veo-3.1-fast-generate-preview', label: 'Veo 3.1 Fast' },
    ],
  },
  {
    id: 'replicate_video', displayName: 'Replicate', category: 'video',
    defaultModel: 'minimax/video-01-live', asyncPattern: 'polling',
    keyProviderId: 'replicate',
    models: [
      { id: 'minimax/video-01-live', label: 'MiniMax Video 01 Live' },
      { id: 'wavespeedai/wan-2.1-i2v-480p', label: 'Wan 2.1 (480p)' },
      { id: 'luma/ray-flash-2-540p', label: 'Luma Ray Flash 2 (540p)' },
    ],
  },
  {
    id: 'huggingface_video', displayName: 'Hugging Face', category: 'video',
    defaultModel: 'Wan-AI/Wan2.1-T2V-14B', asyncPattern: 'sync',
    keyProviderId: 'huggingface',
    keyDisplayName: 'Hugging Face Token',
    // ali-vilab/i2vgen-xl removed: a 2023-era research model with no confirmed current
    // Inference Providers coverage (see /backend/provider-api-audit).
    models: [
      { id: 'Wan-AI/Wan2.1-T2V-14B', label: 'Wan 2.1 T2V 14B' },
    ],
  },
]

export function getCatalogByCategory(category: ProviderMeta['category']): ProviderMeta[] {
  return PROVIDER_CATALOG.filter(p => p.category === category)
}

export function getCatalogEntry(id: string): ProviderMeta | undefined {
  return PROVIDER_CATALOG.find(p => p.id === id)
}
