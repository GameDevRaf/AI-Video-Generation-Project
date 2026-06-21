import Anthropic from '@anthropic-ai/sdk'
import { adminSupabase } from '../lib/supabase'
import { updateJobStatus } from '../lib/jobs'
import type { DbJob } from '../../../app/types/database.types'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

interface SceneData {
  title: string
  script_text: string
  duration: number  // seconds
}

export async function handleSceneSplitJob(job: DbJob) {
  const input = job.input as { script_text: string }

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: `You are a video production assistant. Split the given script into logical scenes for a video.
For each scene, estimate its spoken duration in seconds (assume ~130 words per minute).
Respond with a JSON array only — no markdown, no explanation.
Schema: [{ "title": string, "script_text": string, "duration": number }]`,
    messages: [{ role: 'user', content: `Split this script into scenes:\n\n${input.script_text}` }],
  })

  const raw = message.content
    .filter(b => b.type === 'text')
    .map(b => (b as { type: 'text'; text: string }).text)
    .join('')
    .trim()

  // Strip markdown code fences if present
  const json = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
  const scenes: SceneData[] = JSON.parse(json)

  // Delete any existing scenes for this project (re-split replaces all)
  await adminSupabase.from('scenes').delete().eq('project_id', job.project_id)

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
