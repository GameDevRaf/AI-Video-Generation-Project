import { adminSupabase } from '../lib/supabase'
import { getProviderKey } from '../lib/getProviderKey'
import { providerRegistry } from '../providers/registry'
import { getCatalogEntry } from '../providers/catalog'
import { updateJobStatus } from '../lib/jobs'
import { resolveScriptProvider, extractJsonArray } from '../lib/scriptProvider'
import type { DbJob } from '../../../app/types/database.types'

interface SceneData {
  title: string
  script_text: string
  duration: number  // seconds
}

export async function handleSceneSplitJob(job: DbJob) {
  const input = job.input as { script_text: string; provider?: string; model?: string }

  const providerId = await resolveScriptProvider(job, input.provider)
  const meta = getCatalogEntry(providerId)
  const model = input.model ?? job.model ?? meta?.defaultModel ?? 'claude-sonnet-4-6'

  const apiKey = await getProviderKey(providerId, job.user_id)
  const provider = providerRegistry.script(providerId)

  const { text: raw } = await provider.generate({
    job,
    apiKey,
    model,
    systemPrompt: `You are a video production assistant. Split the given voiceover script into logical scenes for a video.
For each scene, estimate its spoken duration in seconds (assume ~130 words per minute).

Rules:
- "script_text" must contain ONLY the exact spoken words for that scene — copy them verbatim from the input.
- Do NOT add scene numbers, timestamps, visual descriptions, stage directions, or any notes to script_text.
- "title" should be a short descriptive label for the scene (2-5 words).
- "duration" is the estimated spoken duration in seconds based on word count.

Respond with a JSON array only — no markdown, no explanation.
Schema: [{ "title": string, "script_text": string, "duration": number }]`,
    messages: [{ role: 'user', content: `Split this voiceover script into scenes:\n\n${input.script_text}` }],
    maxTokens: 4096,
  })

  // Extract the JSON array from the response, tolerating preamble or code fences
  const scenes: SceneData[] = JSON.parse(extractJsonArray(raw.trim()))

  // Delete any existing scenes for this project (re-split replaces all)
  await adminSupabase.from('scenes').delete().eq('project_id', job.project_id)

  // Scenes changed, so the cohesive visual descriptions are now stale. Drop them
  // (and the shared style anchor) so they are regenerated on the next prompt job.
  await adminSupabase
    .from('job_outputs')
    .delete()
    .eq('project_id', job.project_id)
    .like('label', 'visual_%')

  // Calculate cumulative timestamps and insert
  let cursor = 0
  const rows = scenes.map((scene, i) => {
    const start = cursor
    const end = cursor + scene.duration
    cursor = end
    return {
      project_id: job.project_id,
      job_id: job.id,
      scene_index: i,
      order_index: i,
      title: scene.title,
      script_text: scene.script_text,
      start_time: Math.round(start),
      end_time: Math.round(end),
      duration: scene.duration,
    }
  })

  const { error } = await adminSupabase.from('scenes').insert(rows)
  if (error) throw new Error(`Scene insert failed: ${error.message}`)

  await updateJobStatus(job.id, 'completed', {
    completed_at: new Date().toISOString(),
    output_summary: { scene_count: rows.length, total_duration: cursor },
  })
}
