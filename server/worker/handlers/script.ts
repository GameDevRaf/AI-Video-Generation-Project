import { getProviderKey } from '../lib/getProviderKey'
import { adminSupabase } from '../lib/supabase'
import { providerRegistry } from '../providers/registry'
import { getCatalogEntry } from '../providers/catalog'
import { updateJobStatus, storeTextOutput } from '../lib/jobs'
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
    provider?: string
    model?: string
  }

  const providerId = await resolveScriptProvider(job, input.provider)
  const meta = getCatalogEntry(providerId)
  const model = input.model ?? job.model ?? meta?.defaultModel ?? 'claude-sonnet-4-6'

  const isRefinement = !!input.existing_script

  const systemPrompt = isRefinement
    ? `You are a professional video scriptwriter. The user has an existing script and wants to refine it. Return exactly ONE improved version of the script based on the instructions. Output only the script text — no titles, no labels, no explanations.`
    : `You are a professional video scriptwriter. Generate exactly 3 different script variations for the given idea and tone. Separate each script with the exact delimiter: ---SCRIPT_BREAK---. Output only the three scripts separated by the delimiter — no titles, no labels, no extra text.`

  const userMessage = isRefinement
    ? `Existing script:\n${input.existing_script}\n\nRefinement instructions:\n${input.refinement_instructions}`
    : `Video idea: ${input.idea}\nTone: ${input.tone}\n\nGenerate 3 script variations.`

  const apiKey = await getProviderKey(providerId, job.user_id)
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
      await storeTextOutput(job, scripts[i], `script_candidate_${i + 1}`)
    }
  }

  await updateJobStatus(job.id, 'completed', {
    completed_at: new Date().toISOString(),
    output_summary: { count: isRefinement ? 1 : 3, provider: providerId, model },
  })
}
