import type { DbJob } from '../../../app/types/database.types'

export interface ProviderParams {
  job: DbJob
  apiKey: string
  model: string
}

// ── Script ─────────────────────────────────────────────────
export interface ScriptParams extends ProviderParams {
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
  systemPrompt?: string
  maxTokens?: number
}
export interface ScriptResult { text: string }
export interface ScriptProvider {
  readonly providerId: string
  generate(params: ScriptParams): Promise<ScriptResult>
}

// ── Image ──────────────────────────────────────────────────
export interface ImageParams extends ProviderParams {
  prompt: string
  negativePrompt?: string
  aspectRatio?: string
}
// Stability AI returns raw bytes; all others return a URL
export interface ImageResult {
  imageUrl?: string
  rawBuffer?: Buffer
  mimeType?: string
}
export interface ImageProvider {
  readonly providerId: string
  generate(params: ImageParams): Promise<ImageResult>
}

// ── Audio ──────────────────────────────────────────────────
export interface AudioParams extends ProviderParams {
  text: string
  voiceId: string
  speed?: number
  stability?: number
  similarityBoost?: number
}
export interface AudioResult {
  audioBuffer: Buffer
  mimeType: string
}
export interface AudioProvider {
  readonly providerId: string
  generate(params: AudioParams): Promise<AudioResult>
}

// ── Video ──────────────────────────────────────────────────
export interface VideoParams extends ProviderParams {
  prompt: string
  imageUrl?: string
  duration?: number
  aspectRatio?: string
}
export interface VideoResult { videoUrl: string }
export interface VideoProvider {
  readonly providerId: string
  generate(params: VideoParams): Promise<VideoResult>
}
