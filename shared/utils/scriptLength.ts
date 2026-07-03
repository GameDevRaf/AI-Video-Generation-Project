// Shared script-length estimation math, used by both the app (length selector,
// warning banner) and the worker (generation prompt, scene-split hard block).
// Always imported via relative path — see shared/config/videoFormat.ts for why.
export const WORDS_PER_MINUTE = 130

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

export function estimateSpokenSeconds(wordCount: number): number {
  return (wordCount / WORDS_PER_MINUTE) * 60
}

export function targetWordCount(targetDurationSeconds: number): number {
  return Math.round((targetDurationSeconds / 60) * WORDS_PER_MINUTE)
}
