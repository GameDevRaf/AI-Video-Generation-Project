// ── Request types ──

export interface CreateProjectRequest {
  name: string
  description?: string
}

export interface UpdateProjectRequest {
  name?: string
  description?: string
  current_stage?: string
  status?: string
}

export interface CreateJobRequest {
  projectId: string
  type: string
  input: Record<string, unknown>
}

export interface ReorderScenesRequest {
  projectId: string
  sceneIds: string[] // ordered list of IDs; positions derived from array index
}

export interface UpdateSceneRequest {
  title?: string
  script_text?: string
  duration?: number
  start_time?: number
  end_time?: number
  order_index?: number
}

export interface SaveImagePromptRequest {
  content: string
}

export interface SaveVideoPromptRequest {
  content: string
}

export interface UpdateProjectSettingsRequest {
  prompt_edit_mode?: string
  default_image_model?: string
  default_audio_model?: string
  default_video_model?: string
  default_music_model?: string
  timeline_density?: string
}

export interface UpdateUserSettingsRequest {
  prompt_edit_mode?: string
  default_audio_provider?: string
  default_audio_voice_id?: string
  default_image_model?: string
  default_video_model?: string
  default_music_model?: string
}

export interface SaveProviderKeyRequest {
  provider: string
  secret: string
  keyName?: string
}

// ── Response types ──

export interface ProjectWithSettings {
  id: string
  user_id: string
  name: string
  description: string | null
  status: string
  current_stage: string
  created_at: string
  updated_at: string
  project_settings: {
    prompt_edit_mode: string
    default_image_model: string | null
    default_audio_model: string | null
    default_video_model: string | null
    default_music_model: string | null
  } | null
}

export interface JobWithLatestOutput {
  id: string
  project_id: string
  type: string
  status: string
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
  latest_output?: {
    id: string
    type: string
    label: string | null
    storage_url: string | null
    metadata: Record<string, unknown> | null
  } | null
}

export interface ProviderKeyMeta {
  id: string
  provider: string
  key_name: string | null
  is_active: boolean
  created_at: string
}

export interface ExportRecord {
  id: string
  project_id: string
  job_id: string
  export_type: string
  metadata: Record<string, unknown> | null
  created_at: string
}

export interface UserSettingsResponse {
  user_id: string
  prompt_edit_mode: string
  default_audio_provider: string
  default_audio_voice_id: string | null
  default_image_model: string | null
  default_video_model: string | null
  default_music_model: string | null
  created_at: string
  updated_at: string
}
