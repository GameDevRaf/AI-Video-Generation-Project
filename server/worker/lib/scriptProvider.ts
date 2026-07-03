import { adminSupabase } from './supabase'
import type { DbJob } from '../../../app/types/database.types'

/**
 * Resolve which script-category provider a text job should use.
 * Order: explicit input provider → job.provider → user's default_script_provider → 'anthropic'.
 * Shared by scene_split, image_prompt, video_prompt, and the visual-description step.
 */
export async function resolveScriptProvider(job: DbJob, inputProvider?: string): Promise<string> {
  if (inputProvider || job.provider) return inputProvider ?? job.provider!
  const { data } = await adminSupabase
    .from('user_settings')
    .select('default_script_provider')
    .eq('user_id', job.user_id)
    .single()
  return data?.default_script_provider ?? 'anthropic'
}

/** Strip a leading/trailing ```json code fence if the model wrapped its output. */
function stripCodeFences(text: string): string {
  return text.trim().replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
}

/** Slice the outermost JSON array `[...]` out of an LLM response, tolerating preamble/fences. */
export function extractJsonArray(text: string): string {
  const t = stripCodeFences(text)
  const start = t.indexOf('[')
  const end = t.lastIndexOf(']')
  return start !== -1 && end > start ? t.slice(start, end + 1) : t
}

/** Slice the outermost JSON object `{...}` out of an LLM response, tolerating preamble/fences. */
export function extractJsonObject(text: string): string {
  const t = stripCodeFences(text)
  const start = t.indexOf('{')
  const end = t.lastIndexOf('}')
  return start !== -1 && end > start ? t.slice(start, end + 1) : t
}
