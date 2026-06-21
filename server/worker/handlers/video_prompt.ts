import { adminSupabase } from '../lib/supabase'
import { getProviderKey } from '../lib/getProviderKey'
import { providerRegistry } from '../providers/registry'
import { getCatalogEntry } from '../providers/catalog'
import { updateJobStatus, storeTextOutput } from '../lib/jobs'
import type { DbJob } from '../../../app/types/database.types'

async function resolveProvider(job: DbJob): Promise<string> {
  if (job.provider) return job.provider
  const { data } = await adminSupabase
    .from('user_settings')
    .select('default_script_provider')
    .eq('user_id', job.user_id)
    .single()
  return data?.default_script_provider ?? 'anthropic'
}

function extractJsonArray(text: string): string {
  const start = text.indexOf('[')
  const end = text.lastIndexOf(']')
  if (start !== -1 && end > start) return text.slice(start, end + 1)
  return text
}

export async function handleVideoPromptJob(job: DbJob) {
  const input = job.input as { scene_id?: string } | null
  let query = adminSupabase
    .from('scenes')
    .select('id, title, script_text, duration')
    .eq('project_id', job.project_id)

  if (input?.scene_id) query = query.eq('id', input.scene_id)

  const { data: scenes } = await query
    .order('order_index')

  if (!scenes?.length) throw new Error('No scenes found')

  const providerId = await resolveProvider(job)
  const meta = getCatalogEntry(providerId)
  const model = job.model ?? meta?.defaultModel ?? 'claude-sonnet-4-6'

  const apiKey = await getProviderKey(providerId, job.user_id)
  const provider = providerRegistry.script(providerId)

  const { text: raw } = await provider.generate({
    job,
    apiKey,
    model,
    systemPrompt: `You are a video director. For each scene write a video motion prompt describing camera movement, action, and visual flow. Keep prompts under 100 words. Suitable for AI video generators like Runway or Kling.
Respond with JSON only. Schema: [{ "scene_id": string, "prompt": string }]`,
    messages: [{
      role: 'user',
      content: `Generate video prompts for:\n${JSON.stringify(scenes.map(s => ({ scene_id: s.id, title: s.title, script_text: s.script_text, duration_seconds: s.duration })))}`,
    }],
    maxTokens: 4096,
  })

  const prompts: { scene_id: string; prompt: string }[] = JSON.parse(extractJsonArray(raw.trim()))

  for (const { scene_id, prompt } of prompts) {
    await storeTextOutput(job, prompt, `video_prompt_scene_${scene_id}`)
  }

  await updateJobStatus(job.id, 'completed', {
    completed_at: new Date().toISOString(),
    output_summary: { prompt_count: prompts.length },
  })
}
