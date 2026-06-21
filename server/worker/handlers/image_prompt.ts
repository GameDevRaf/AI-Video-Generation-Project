import Anthropic from '@anthropic-ai/sdk'
import { adminSupabase } from '../lib/supabase'
import { updateJobStatus, storeTextOutput } from '../lib/jobs'
import type { DbJob } from '../../../app/types/database.types'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function handleImagePromptJob(job: DbJob) {
  const { data: scenes, error } = await adminSupabase
    .from('scenes')
    .select('id, title, script_text')
    .eq('project_id', job.project_id)
    .order('order_index')

  if (error || !scenes?.length) throw new Error('No scenes found for project')

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: `You are a visual artist and prompt engineer. For each scene, write a detailed image generation prompt that captures the visual mood, setting, characters, and style. The prompt should work for AI image generators like Stable Diffusion or DALL-E.
Respond with a JSON array only — no markdown, no explanation.
Schema: [{ "scene_id": string, "prompt": string }]`,
    messages: [{
      role: 'user',
      content: `Generate image prompts for these scenes:\n${JSON.stringify(scenes.map(s => ({ scene_id: s.id, title: s.title, script_text: s.script_text })))}`,
    }],
  })

  const raw = message.content
    .filter(b => b.type === 'text')
    .map(b => (b as { type: 'text'; text: string }).text)
    .join('')
    .trim()
    .replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')

  const prompts: { scene_id: string; prompt: string }[] = JSON.parse(raw)

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
