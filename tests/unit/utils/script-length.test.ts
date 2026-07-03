// @vitest-environment node
import { describe, it, expect } from 'vitest'
import {
  WORDS_PER_MINUTE,
  countWords,
  estimateSpokenSeconds,
  targetWordCount,
} from '../../../shared/utils/scriptLength'

describe('countWords', () => {
  it('counts whitespace-separated words', () => {
    expect(countWords('The quick brown fox')).toBe(4)
  })

  it('ignores leading/trailing/extra whitespace', () => {
    expect(countWords('  one   two \n three  ')).toBe(3)
  })

  it('returns 0 for empty text', () => {
    expect(countWords('   ')).toBe(0)
  })
})

describe('estimateSpokenSeconds', () => {
  it('converts word count to seconds at 130 wpm', () => {
    expect(estimateSpokenSeconds(WORDS_PER_MINUTE)).toBe(60)
    expect(estimateSpokenSeconds(WORDS_PER_MINUTE * 3)).toBe(180)
  })

  it('returns 0 for 0 words', () => {
    expect(estimateSpokenSeconds(0)).toBe(0)
  })
})

describe('targetWordCount', () => {
  it('converts a target duration to a rounded word count at 130 wpm', () => {
    expect(targetWordCount(60)).toBe(130)
    expect(targetWordCount(180)).toBe(390)
  })

  it('round-trips with estimateSpokenSeconds for whole-minute targets', () => {
    const words = targetWordCount(120)
    expect(Math.round(estimateSpokenSeconds(words))).toBe(120)
  })
})
