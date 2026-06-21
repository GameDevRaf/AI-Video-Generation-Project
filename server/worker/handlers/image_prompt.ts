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

export async function handleImagePromptJob(job: DbJob) {
  const { data: scenes, error } = await adminSupabase
    .from('scenes')
    .select('id, title, script_text')
    .eq('project_id', job.project_id)
    .order('order_index')

  if (error || !scenes?.length) throw new Error('No scenes found for project')

  const providerId = await resolveProvider(job)
  const meta = getCatalogEntry(providerId)
  const model = job.model ?? meta?.defaultModel ?? 'claude-sonnet-4-6'

  const apiKey = await getProviderKey(providerId, job.user_id)
  const provider = providerRegistry.script(providerId)

  const { text: raw } = await provider.generate({
    job,
    apiKey,
    model,
    systemPrompt: `You are a visual artist and prompt engineer. For each scene, write a detailed image generation prompt that captures the visual mood, setting, characters, and style. The prompt should work for AI image generators like Stable Diffusion or DALL-E.
Respond with a JSON array only — no markdown, no explanation.
Schema: [{ "scene_id": string, "prompt": string }]`,
    messages: [{
      role: 'user',
      content: `Generate image prompts for these scenes:\n${JSON.stringify(scenes.map(s => ({ scene_id: s.id, title: s.title, script_text: s.script_text })))}`,
    }],
    maxTokens: 4096,
  })

  const prompts: { scene_id: string; prompt: string }[] = JSON.parse(extractJsonArray(raw.trim()))

  for (const { scene_id, prompt } of prompts) {
    await storeTextOutput(
      { ...job, project_id: job.project_id },
      prompt,
      `image_prompt_scene_${scene_id}`,
    )
  }

  await updateJobStatus(job.id, 'completed', {
    completed_at: new Date().toISOString(),
    output_summary: { prompt_count: prompts.length },
  })
}
