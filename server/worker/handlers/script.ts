import Anthropic from '@anthropic-ai/sdk'
import { updateJobStatus, storeTextOutput } from '../lib/jobs'
import type { DbJob } from '../../../app/types/database.types'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function handleScriptJob(job: DbJob) {
  const input = job.input as { idea: string; tone: string; existing_script?: string; refinement_instructions?: string }

  const isRefinement = !!input.existing_script

  const systemPrompt = isRefinement
    ? `You are a professional video scriptwriter. The user has an existing script and wants to refine it. Return exactly ONE improved version of the script based on the instructions. Output only the script text — no titles, no labels, no explanations.`
    : `You are a professional video scriptwriter. Generate exactly 3 different script variations for the given idea and tone. Separate each script with the exact delimiter: ---SCRIPT_BREAK---. Output only the three scripts separated by the delimiter — no titles, no labels, no extra text.`

  const userMessage = isRefinement
    ? `Existing script:\n${input.existing_script}\n\nRefinement instructions:\n${input.refinement_instructions}`
    : `Video idea: ${input.idea}\nTone: ${input.tone}\n\nGenerate 3 script variations.`

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    messages: [{ role: 'user', content: userMessage }],
    system: systemPrompt,
  })

  const fullText = message.content
    .filter(b => b.type === 'text')
    .map(b => (b as { type: 'text'; text: string }).text)
    .join('')

  if (isRefinement) {
    await storeTextOutput(job, fullText.trim(), 'script_refined')
  } else {
    const scripts = fullText.split('---SCRIPT_BREAK---').map(s => s.trim()).filter(Boolean)
    for (let i = 0; i < Math.min(scripts.length, 3); i++) {
      await storeTextOutput(job, scripts[i], `script_candidate_${i + 1}`)
    }
  }

  await updateJobStatus(job.id, 'completed', {
    completed_at: new Date().toISOString(),
    output_summary: { count: isRefinement ? 1 : 3 },
  })
}
