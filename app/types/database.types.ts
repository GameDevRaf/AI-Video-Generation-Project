export type JobType =
  | 'script'
  | 'scene_split'
  | 'image_prompt'
  | 'image'
  | 'audio'
  | 'video_prompt'
  | 'video'
  | 'music'
  | 'export'
  | 'publish'

export type JobStatus =
  | 'queued'
  | 'processing'
  | 'waiting_on_provider'
  | 'completed'
  | 'failed'
  | 'retrying'

export type OutputType = 'text' | 'image' | 'audio' | 'video' | 'music' | 'json' | 'file'

export type AssetRole = 'first_frame' | 'voice' | 'generated_video' | 'music_bed'

export type PromptEditMode = 'before_generation' | 'after_generation'

// ---- Row types ----

export interface DbUser {
  id: string
  username: string | null
  email: string | null
  avatar_url: string | null
  created_at: string
  updated_at: string
}

export interface DbProject {
  id: string
  user_id: string
  name: string
  description: string | null
  status: string
  current_stage: string
  created_at: string
  updated_at: string
}

export interface DbJob {
  id: string
  user_id: string
  project_id: string
  type: JobType
  status: JobStatus
  provider: string | null
  model: string | null
  input: Record<string, unknown> | null
  output_summary: Record<string, unknown> | null
  error_message: string | null
  retry_count: number
  created_at: string
  updated_at: string
  started_at: string | null
  completed_at: string | null
}

export interface DbJobOutput {
  id: string
  job_id: string
  project_id: string
  type: OutputType
  label: string | null
  storage_url: string | null
  storage_path: string | null
  mime_type: string | null
  metadata: Record<string, unknown> | null
  created_at: string
}

export interface DbScene {
  id: string
  project_id: string
  job_id: string | null
  scene_index: number
  title: string | null
  script_text: string
  start_time: number | null
  end_time: number | null
  duration: number | null
  order_index: number
  created_at: string
  updated_at: string
}

export interface DbSceneAsset {
  id: string
  scene_id: string
  job_output_id: string
  asset_type: string
  role: AssetRole
  created_at: string
}

export interface DbProjectSettings {
  id: string
  project_id: string
  prompt_edit_mode: PromptEditMode
  default_image_model: string | null
  default_audio_model: string | null
  default_video_model: string | null
  default_music_model: string | null
  timeline_density: string | null
  // migration 004 — per-project provider overrides (null = inherit from user_settings)
  default_script_provider: string | null
  default_image_provider: string | null
  default_audio_provider: string | null
  default_video_provider: string | null
  // migration 006 — Skip Video Gen (images-only export mode)
  skip_video_gen: boolean
  // migration 007 — target video length (Script Length Guard + selector)
  target_duration_seconds: number
  // migration 008 — script model override (missing since migration 004)
  default_script_model: string | null
  created_at: string
  updated_at: string
}

export interface DbUserSettings {
  id: string
  user_id: string
  default_script_provider: string   // DEFAULT 'anthropic'
  default_image_provider: string    // DEFAULT 'fal'
  default_video_provider: string    // DEFAULT 'runway'
  default_audio_model: string | null
  created_at: string
  updated_at: string
}

export interface DbApiKey {
  id: string
  user_id: string
  provider: string
  key_name: string | null
  encrypted_secret: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface DbConnectedAccount {
  id: string
  user_id: string
  provider: string
  account_label: string | null
  auth_type: string | null
  connection_status: string
  session_reference: string | null
  metadata: Record<string, unknown> | null
  created_at: string
  updated_at: string
}
