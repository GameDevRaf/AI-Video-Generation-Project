import Anthropic from '@anthropic-ai/sdk'
import { adminSupabase } from '../lib/supabase'
import { updateJobStatus, storeTextOutput } from '../lib/jobs'
import type { DbJob } from '../../../app/types/database.types'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function handleVideoPromptJob(job: DbJob) {
  const { data: scenes } = await adminSupabase
    .from('scenes')
    .select('id, title, script_text, duration')
    .eq('project_id', job.project_id)
    .order('order_index')

  if (!scenes?.length) throw new Error('No scenes found')

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: `You are a video director. For each scene write a video motion prompt describing camera movement, action, and visual flow. Keep prompts under 100 words. Suitable for AI video generators like Runway or Kling.
Respond with JSON only. Schema: [{ "scene_id": string, "prompt": string }]`,
    messages: [{
      role: 'user',
      content: `Generate video prompts for:\n${JSON.stringify(scenes.map(s => ({ scene_id: s.id, title: s.title, script_text: s.script_text, duration_seconds: s.duration })))}`,
    }],
  })

  const raw = message.content
    .filter(b => b.type === 'text')
    .map(b => (b as { type: 'text'; text: string }).text)
    .join('').trim()
    .replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')

  const prompts: { scene_id: string; prompt: string }[] = JSON.parse(raw)

  for (const { scene_id, prompt } of prompts) {
    await storeTextOutput(job, prompt, `video_prompt_scene_${scene_id}`)
  }

  await updateJobStatus(job.id, 'completed', {
    completed_at: new Date().toISOString(),
    output_summary: { prompt_count: prompts.length },
  })
}
