// @vitest-environment node
// Tests the cumulative timestamp recalculation algorithm used in useScenes
import { describe, it, expect } from 'vitest'

type SceneStub = { duration: number | null }

function recalcTimestamps(scenes: SceneStub[]) {
  let t = 0
  return scenes.map(s => {
    const start = t
    t += s.duration ?? 0
    return { start_time: start, end_time: t }
  })
}

describe('recalcTimestamps', () => {
  it('calculates cumulative start/end from durations', () => {
    const result = recalcTimestamps([
      { duration: 5 },
      { duration: 10 },
      { duration: 7 },
    ])
    expect(result[0]).toEqual({ start_time: 0, end_time: 5 })
    expect(result[1]).toEqual({ start_time: 5, end_time: 15 })
    expect(result[2]).toEqual({ start_time: 15, end_time: 22 })
  })

  it('treats null duration as zero without breaking sequence', () => {
    const result = recalcTimestamps([
      { duration: null },
      { duration: 5 },
      { duration: 3 },
    ])
    expect(result[0]).toEqual({ start_time: 0, end_time: 0 })
    expect(result[1]).toEqual({ start_time: 0, end_time: 5 })
    expect(result[2]).toEqual({ start_time: 5, end_time: 8 })
  })

  it('returns empty array for empty input', () => {
    expect(recalcTimestamps([])).toEqual([])
  })

  it('handles a single scene starting at zero', () => {
    const result = recalcTimestamps([{ duration: 30 }])
    expect(result[0]).toEqual({ start_time: 0, end_time: 30 })
  })

  it('handles fractional durations', () => {
    const result = recalcTimestamps([{ duration: 5.5 }, { duration: 2.5 }])
    expect(result[0].end_time).toBeCloseTo(5.5)
    expect(result[1].start_time).toBeCloseTo(5.5)
    expect(result[1].end_time).toBeCloseTo(8)
  })
})
