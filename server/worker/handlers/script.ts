import { getProviderKey } from '../lib/getProviderKey'
import { adminSupabase } from '../lib/supabase'
import { providerRegistry } from '../providers/registry'
import { getCatalogEntry } from '../providers/catalog'
import { updateJobStatus, storeTextOutput } from '../lib/jobs'
import { VIDEO_FORMAT } from '../../../shared/config/videoFormat'
import { targetWordCount } from '../../../shared/utils/scriptLength'
import type { DbJob } from '../../../app/types/database.types'

async function resolveScriptProvider(job: DbJob, inputProvider?: string): Promise<string> {
  if (inputProvider || job.provider) return inputProvider ?? job.provider!
  const { data } = await adminSupabase
    .from('user_settings')
    .select('default_script_provider')
    .eq('user_id', job.user_id)
    .single()
  return data?.default_script_provider ?? 'anthropic'
}

export async function handleScriptJob(job: DbJob) {
  const input = job.input as {
    idea: string
    tone: string
    existing_script?: string
    refinement_instructions?: string
    target_duration_seconds?: number
    provider?: string
    model?: string
  }

  const providerId = await resolveScriptProvider(job, input.provider)
  const meta = getCatalogEntry(providerId)
  const model = input.model ?? job.model ?? meta?.defaultModel ?? 'claude-sonnet-4-6'

  const isRefinement = !!input.existing_script

  const targetSeconds = Math.min(input.target_duration_seconds ?? 180, VIDEO_FORMAT.maxDuration)
  const targetWords = targetWordCount(targetSeconds)
  const targetLine = `Target length: approximately ${targetWords} words (~${targetSeconds}s of narration at ~130 words per minute). Do not significantly exceed this length.`

  const systemPrompt = isRefinement
    ? `You are a professional video scriptwriter specialising in voiceover narration. The user has an existing voiceover script and wants to refine it. Return exactly ONE improved version.

Rules:
- Output ONLY the spoken words — nothing else.
- Do NOT include: scene numbers, timestamps, stage directions, visual descriptions, [brackets], (parentheses), camera notes, or any meta-text.
- The result must read as a clean monologue that could be spoken directly into a microphone.
- ${targetLine}`
    : `You are a professional video scriptwriter specialising in voiceover narration. Generate exactly 3 different voiceover script variations for the given idea and tone.

Rules:
- Write ONLY the words that will be spoken aloud by the narrator — nothing else.
- Do NOT include: scene numbers, timestamps, stage directions, visual descriptions, [brackets], (parentheses), camera notes, or any meta-text whatsoever.
- Each script must read as a clean, continuous monologue that could be read directly into a microphone.
- ${targetLine}
- Separate the three scripts with the exact delimiter: ---SCRIPT_BREAK---
- Output only the three scripts separated by the delimiter — no preamble, no titles, no labels.`

  const userMessage = isRefinement
    ? `Existing script:\n${input.existing_script}\n\nRefinement instructions:\n${input.refinement_instructions}`
    : `Video idea: ${input.idea}\nTone: ${input.tone}\n\nGenerate 3 script variations.`

  const apiKey = await getProviderKey(meta?.keyProviderId ?? providerId, job.user_id)
  const provider = providerRegistry.script(providerId)

  const { text } = await provider.generate({
    job,
    apiKey,
    model,
    systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
    maxTokens: 4096,
  })

  if (isRefinement) {
    await storeTextOutput(job, text.trim(), 'script_refined')
  } else {
    const scripts = text.split('---SCRIPT_BREAK---').map(s => s.trim()).filter(Boolean)
    for (let i = 0; i < Math.min(scripts.length, 3); i++) {
      await storeTextOutput(job, scripts[i]!, `script_candidate_${i + 1}`)
    }
  }

  await updateJobStatus(job.id, 'completed', {
    completed_at: new Date().toISOString(),
    output_summary: { count: isRefinement ? 1 : 3, provider: providerId, model },
  })
}
