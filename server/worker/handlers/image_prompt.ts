import { adminSupabase } from '../lib/supabase'
import { getProviderKey } from '../lib/getProviderKey'
import { providerRegistry } from '../providers/registry'
import { getCatalogEntry } from '../providers/catalog'
import { updateJobStatus, storeTextOutput } from '../lib/jobs'
import { resolveScriptProvider, extractJsonArray } from '../lib/scriptProvider'
import { ensureVisualDescriptions } from '../lib/visualDescriptions'
import type { DbJob } from '../../../app/types/database.types'

function systemPrompt(anchor: string): string {
  return `You are an expert image-generation prompt engineer. Each image is the FIRST FRAME of a scene in a vertical 9:16 short-form video — it must be a single coherent still that a video model can then animate from.

Shared visual style for the whole video (keep every image consistent with this, especially recurring characters and objects):
${anchor || '(none provided)'}

For each scene you are given its visual description. Write one richly detailed image prompt capturing subject, setting, composition, lighting, colour and art style. Do NOT describe motion. Keep recurring subjects visually identical across scenes.

Respond with a JSON array only — no markdown, no explanation.
Schema: [{ "scene_id": string, "prompt": string }]`
}

export async function handleImagePromptJob(job: DbJob) {
  const input = (job.input ?? {}) as { scene_id?: string }

  const { data: allScenes, error } = await adminSupabase
    .from('scenes')
    .select('id, title, script_text')
    .eq('project_id', job.project_id)
    .order('order_index')

  if (error || !allScenes?.length) throw new Error('No scenes found for project')

  const providerId = await resolveScriptProvider(job)
  const meta = getCatalogEntry(providerId)
  const model = job.model ?? meta?.defaultModel ?? 'claude-sonnet-4-6'
  const apiKey = await getProviderKey(providerId, job.user_id)

  // Establish (or reuse) the cohesive visual descriptions before writing image prompts.
  const { anchor, byScene } = await ensureVisualDescriptions(job, {
    providerId, apiKey, model, scenes: allScenes,
  })

  // A specific scene_id regenerates just that scene; otherwise cover all scenes.
  const targets = input.scene_id
    ? allScenes.filter(s => s.id === input.scene_id)
    : allScenes

  if (!targets.length) throw new Error('Scene not found')

  const provider = providerRegistry.script(providerId)
  const { text: raw } = await provider.generate({
    job,
    apiKey,
    model,
    systemPrompt: systemPrompt(anchor),
    messages: [{
      role: 'user',
      content: `Write image prompts from these visual descriptions:\n${JSON.stringify(
        targets.map(s => ({
          scene_id: s.id,
          title: s.title,
          visual_description: byScene.get(s.id) ?? s.script_text,
        })),
      )}`,
    }],
    maxTokens: 4096,
  })

  const prompts: { scene_id: string; prompt: string }[] = JSON.parse(extractJsonArray(raw.trim()))

  for (const { scene_id, prompt } of prompts) {
    await storeTextOutput(job, prompt, `image_prompt_scene_${scene_id}`)
  }

  await updateJobStatus(job.id, 'completed', {
    completed_at: new Date().toISOString(),
    output_summary: { prompt_count: prompts.length },
  })
}
