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
    models: [
      { id: 'V_3', label: 'Ideogram v3' },
      { id: 'V_2', label: 'Ideogram v2' },
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
    models: [
      { id: 'kling-v2-master', label: 'Kling v2 Master' },
      { id: 'kling-v1-pro', label: 'Kling v1 Pro' },
      { id: 'kling-v1-5-pro', label: 'Kling v1.5 Pro' },
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
    defaultModel: 'fal-ai/pika-ai/pikav2.2', asyncPattern: 'queue',
    models: [
      { id: 'fal-ai/pika-ai/pikav2.2', label: 'Pika v2.2' },
      { id: 'fal-ai/minimax/video-01', label: 'MiniMax Video 01' },
    ],
  },
]

export function getCatalogByCategory(category: ProviderMeta['category']): ProviderMeta[] {
  return PROVIDER_CATALOG.filter(p => p.category === category)
}

export function getCatalogEntry(id: string): ProviderMeta | undefined {
  return PROVIDER_CATALOG.find(p => p.id === id)
}
