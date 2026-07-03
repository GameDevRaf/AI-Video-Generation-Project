import { adminSupabase } from '../lib/supabase'
import { getProviderKey } from '../lib/getProviderKey'
import { providerRegistry } from '../providers/registry'
import { getCatalogEntry } from '../providers/catalog'
import { updateJobStatus, storeTextOutput } from '../lib/jobs'
import { resolveScriptProvider } from '../lib/scriptProvider'
import { ensureVisualDescriptions } from '../lib/visualDescriptions'
import type { DbJob } from '../../../app/types/database.types'
import type { ScriptImage } from '../providers/types'

// Script providers whose adapters render attached images (see providers/script/*).
const VISION_CAPABLE = new Set(['anthropic', 'openai', 'gemini'])

function systemPrompt(anchor: string): string {
  return `You are a video director. You are given a scene's visual description and, when available, its first-frame image. Write a concise motion prompt (under 80 words) describing how this shot animates FROM that first frame: subject action, camera movement and pacing. Keep it consistent with the shared visual style. Describe motion only — do not restate the scene in full or the narration. Return ONLY the prompt text: no labels, no quotes, no JSON.

Shared visual style: ${anchor || '(none provided)'}`
}

/** Newest generated first-frame image URL per requested scene (label `scene_image_{id}`). */
async function loadSceneImageUrls(projectId: string, sceneIds: string[]): Promise<Map<string, string>> {
  const { data } = await adminSupabase
    .from('job_outputs')
    .select('label, storage_url, created_at')
    .eq('project_id', projectId)
    .eq('type', 'image')
    .like('label', 'scene_image_%')
    .order('created_at', { ascending: false })

  const wanted = new Set(sceneIds)
  const map = new Map<string, string>()
  for (const row of data ?? []) {
    const sceneId = (row.label as string).replace('scene_image_', '')
    const url = row.storage_url as string | null
    if (url && wanted.has(sceneId) && !map.has(sceneId)) map.set(sceneId, url)
  }
  return map
}

/** Fetch an image URL into base64 for a vision call. Returns null on any failure. */
async function fetchImage(url: string): Promise<ScriptImage | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const buffer = Buffer.from(await res.arrayBuffer())
    const mimeType = res.headers.get('content-type')?.split(';')[0] ?? 'image/png'
    return { base64: buffer.toString('base64'), mimeType }
  } catch {
    return null
  }
}

export async function handleVideoPromptJob(job: DbJob) {
  const input = (job.input ?? {}) as { scene_id?: string }

  const { data: allScenes } = await adminSupabase
    .from('scenes')
    .select('id, title, script_text, duration')
    .eq('project_id', job.project_id)
    .order('order_index')

  if (!allScenes?.length) throw new Error('No scenes found')

  const providerId = await resolveScriptProvider(job)
  const meta = getCatalogEntry(providerId)
  const model = job.model ?? meta?.defaultModel ?? 'claude-sonnet-4-6'
  const apiKey = await getProviderKey(providerId, job.user_id)

  // Establish (or reuse) the cohesive visual descriptions before writing motion prompts.
  const { anchor, byScene } = await ensureVisualDescriptions(job, {
    providerId, apiKey, model, scenes: allScenes,
  })

  const targets = input.scene_id
    ? allScenes.filter(s => s.id === input.scene_id)
    : allScenes

  if (!targets.length) throw new Error('Scene not found')

  const provider = providerRegistry.script(providerId)
  const sys = systemPrompt(anchor)
  const imageUrls = VISION_CAPABLE.has(providerId)
    ? await loadSceneImageUrls(job.project_id, targets.map(s => s.id))
    : new Map<string, string>()

  // One call per scene so each motion prompt can be conditioned on its own first frame.
  let promptCount = 0
  for (const scene of targets) {
    const description = byScene.get(scene.id) ?? scene.script_text
    const imageUrl = imageUrls.get(scene.id)
    const image = imageUrl ? await fetchImage(imageUrl) : null

    const userText = [
      `Visual description: ${description}`,
      `Target shot length: ~${scene.duration ?? 5}s.`,
      image ? 'The attached image is this scene\'s first frame — animate from it.' : '',
      'Write the motion prompt.',
    ].filter(Boolean).join('\n')

    let text: string
    try {
      const res = await provider.generate({
        job, apiKey, model,
        systemPrompt: sys,
        messages: [{ role: 'user', content: userText }],
        images: image ? [image] : undefined,
        maxTokens: 1024,
      })
      text = res.text
    } catch (err) {
      // Vision call failed — retry once without the image (graceful text-only fallback).
      if (!image) throw err
      const res = await provider.generate({
        job, apiKey, model,
        systemPrompt: sys,
        messages: [{ role: 'user', content: userText }],
        maxTokens: 1024,
      })
      text = res.text
    }

    await storeTextOutput(job, text.trim(), `video_prompt_scene_${scene.id}`)
    promptCount++
  }

  await updateJobStatus(job.id, 'completed', {
    completed_at: new Date().toISOString(),
    output_summary: { prompt_count: promptCount },
  })
}
