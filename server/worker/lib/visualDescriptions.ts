import { adminSupabase } from './supabase'
import { storeTextOutput } from './jobs'
import { providerRegistry } from '../providers/registry'
import { extractJsonObject } from './scriptProvider'
import type { DbJob } from '../../../app/types/database.types'

/** Minimal scene shape needed to plan visual descriptions. */
export interface SceneLite {
  id: string
  title: string | null
  script_text: string
}

export interface VisualDescriptions {
  /** Shared style/character bible applied to every scene (may be empty). */
  anchor: string
  /** scene_id → visual scene description. */
  byScene: Map<string, string>
}

export const VISUAL_ANCHOR_LABEL = 'visual_style_anchor'
export const visualDescriptionLabel = (sceneId: string) => `visual_description_scene_${sceneId}`

const SYSTEM_PROMPT = `You are the visual director for a short-form vertical (9:16) video. You receive every scene of one video as JSON (spoken narration only). Design a single, coherent visual world for the WHOLE video.

Return a JSON object ONLY — no markdown, no commentary — with this exact schema:
{
  "style_anchor": string,
  "scenes": [{ "scene_id": string, "description": string }]
}

- "style_anchor": 1-3 sentences describing the shared art style, colour palette, lighting and mood, PLUS any recurring characters or objects described precisely enough (age, build, clothing, colours, distinguishing features) that they can be drawn IDENTICALLY every time they reappear.
- "description" (one per scene): what is actually shown on screen — subject, setting, action, composition, atmosphere. 2-4 sentences. When a character or object from style_anchor appears, reuse its exact description so it stays consistent across scenes. Describe visuals only; never restate the narration text.
- Include every scene_id from the input exactly once.`

/**
 * Ensure a cohesive, project-wide set of visual scene descriptions exists.
 *
 * Generate-once: if a description already exists for every current scene, the
 * stored set is reused. Otherwise all scenes are (re)planned in a single LLM
 * call so recurring characters/objects stay visually consistent across scenes,
 * then persisted as `job_outputs` (label `visual_description_scene_{id}` plus a
 * shared `visual_style_anchor`). Idempotent and safe under worker retries.
 */
export async function ensureVisualDescriptions(
  job: DbJob,
  opts: { providerId: string; apiKey: string; model: string; scenes: SceneLite[] },
): Promise<VisualDescriptions> {
  const { scenes } = opts

  // 1. Load any previously stored descriptions/anchor for this project (newest first).
  const { data: existing } = await adminSupabase
    .from('job_outputs')
    .select('label, metadata, created_at')
    .eq('project_id', job.project_id)
    .like('label', 'visual_%')
    .order('created_at', { ascending: false })

  const byScene = new Map<string, string>()
  let anchor = ''
  for (const row of existing ?? []) {
    const label = row.label as string
    const content = (row.metadata as { content?: string } | null)?.content ?? ''
    if (label === VISUAL_ANCHOR_LABEL) {
      if (!anchor) anchor = content
    } else if (label.startsWith('visual_description_scene_')) {
      const sceneId = label.replace('visual_description_scene_', '')
      if (!byScene.has(sceneId)) byScene.set(sceneId, content) // newest wins
    }
  }

  // 2. Reuse when every current scene already has a description (generate-once).
  const complete = scenes.length > 0 && scenes.every(s => byScene.has(s.id))
  if (complete) return { anchor, byScene }

  // 3. Plan all scenes together in one call for cross-scene cohesion.
  const provider = providerRegistry.script(opts.providerId)
  const { text: raw } = await provider.generate({
    job,
    apiKey: opts.apiKey,
    model: opts.model,
    systemPrompt: SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: `Plan the visual direction for these scenes:\n${JSON.stringify(
        scenes.map(s => ({ scene_id: s.id, title: s.title, script_text: s.script_text })),
      )}`,
    }],
    maxTokens: 4096,
  })

  const parsed = JSON.parse(extractJsonObject(raw.trim())) as {
    style_anchor?: string
    scenes?: { scene_id: string; description: string }[]
  }

  anchor = parsed.style_anchor ?? anchor ?? ''
  const generated = new Map<string, string>()
  for (const s of parsed.scenes ?? []) generated.set(s.scene_id, s.description)

  // 4. Persist the anchor and each scene's description; refresh the return map.
  if (anchor) await storeTextOutput(job, anchor, VISUAL_ANCHOR_LABEL)
  for (const s of scenes) {
    const desc = generated.get(s.id)
    if (desc) {
      await storeTextOutput(job, desc, visualDescriptionLabel(s.id))
      byScene.set(s.id, desc)
    }
  }

  return { anchor, byScene }
}
