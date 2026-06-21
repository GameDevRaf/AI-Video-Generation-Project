// @vitest-environment node
// Tests the ---SCRIPT_BREAK--- parsing logic used in the script worker handler
import { describe, it, expect } from 'vitest'

const DELIMITER = '---SCRIPT_BREAK---'

function parseScriptCandidates(raw: string): string[] {
  return raw
    .split(DELIMITER)
    .map(s => s.trim())
    .filter(Boolean)
}

describe('script candidate parser', () => {
  it('splits three candidates correctly', () => {
    const raw = `Script one content\n${DELIMITER}\nScript two content\n${DELIMITER}\nScript three content`
    const result = parseScriptCandidates(raw)
    expect(result).toHaveLength(3)
    expect(result[0]).toBe('Script one content')
    expect(result[1]).toBe('Script two content')
    expect(result[2]).toBe('Script three content')
  })

  it('trims whitespace around each candidate', () => {
    const raw = `  \n  Script A  \n  ${DELIMITER}  \n  Script B  \n  `
    const result = parseScriptCandidates(raw)
    expect(result[0]).toBe('Script A')
    expect(result[1]).toBe('Script B')
  })

  it('returns one candidate when no delimiter present', () => {
    const raw = 'A single script with no break marker'
    const result = parseScriptCandidates(raw)
    expect(result).toHaveLength(1)
    expect(result[0]).toBe('A single script with no break marker')
  })

  it('filters empty segments between consecutive delimiters', () => {
    const raw = `${DELIMITER}${DELIMITER}Real script${DELIMITER}`
    const result = parseScriptCandidates(raw)
    expect(result).toHaveLength(1)
    expect(result[0]).toBe('Real script')
  })

  it('handles multi-paragraph candidates', () => {
    const raw = `Para 1.\n\nPara 2.\n${DELIMITER}\nScene B`
    const result = parseScriptCandidates(raw)
    expect(result[0]).toBe('Para 1.\n\nPara 2.')
    expect(result[1]).toBe('Scene B')
  })
})
