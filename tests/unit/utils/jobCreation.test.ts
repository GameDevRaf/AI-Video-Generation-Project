// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { createJobWithDedup, getRetryableJob } from '../../../server/utils/jobCreation'

// Minimal chainable Supabase query-builder stub: every method but the terminal
// one (`single`/`maybeSingle`) returns itself, and the terminal method resolves
// to the configured value — enough to exercise the exact chain jobCreation.ts calls.
function makeChain(resolveValue: unknown) {
  const chain: Record<string, unknown> = {}
  for (const method of ['select', 'eq', 'in', 'is', 'order', 'limit', 'insert']) {
    chain[method] = () => chain
  }
  chain.single = () => Promise.resolve(resolveValue)
  chain.maybeSingle = () => Promise.resolve(resolveValue)
  return chain
}

describe('createJobWithDedup', () => {
  it('throws 403 when the project is not owned by the user', async () => {
    const supabase = {
      from: vi.fn(() => makeChain({ data: null })),
    }
    await expect(
      createJobWithDedup(supabase as never, 'user-1', { projectId: 'proj-1', type: 'script' }),
    ).rejects.toMatchObject({ statusCode: 403 })
  })

  it('returns the existing job instead of inserting when a queued/processing duplicate exists (no scene_id)', async () => {
    const existingJob = { id: 'job-existing', status: 'queued' }
    const projectChain = makeChain({ data: { id: 'proj-1' } })
    const dedupChain = makeChain({ data: existingJob })
    const insertChain = makeChain({ data: { id: 'job-new' }, error: null })

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'projects') return projectChain
        return { select: () => dedupChain, insert: () => insertChain }
      }),
    }

    const result = await createJobWithDedup(supabase as never, 'user-1', { projectId: 'proj-1', type: 'script' })
    expect(result).toBe(existingJob)
  })

  it('matches the dedupe query on scene_id when input.scene_id is present', async () => {
    const projectChain = makeChain({ data: { id: 'proj-1' } })
    const dedupChain = makeChain({ data: null })
    const insertChain = makeChain({ data: { id: 'job-new' }, error: null })
    const eqSpy = vi.fn(() => dedupChain)
    dedupChain.eq = eqSpy

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'projects') return projectChain
        return { select: () => dedupChain, insert: () => insertChain }
      }),
    }

    await createJobWithDedup(supabase as never, 'user-1', {
      projectId: 'proj-1',
      type: 'image',
      input: { scene_id: 'scene-1' },
    })
    expect(eqSpy).toHaveBeenCalledWith('input->>scene_id', 'scene-1')
  })

  it('inserts and returns a new job when no duplicate exists', async () => {
    const projectChain = makeChain({ data: { id: 'proj-1' } })
    const dedupChain = makeChain({ data: null })
    const newJob = { id: 'job-new', status: 'queued' }
    const insertChain = makeChain({ data: newJob, error: null })

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'projects') return projectChain
        return { select: () => dedupChain, insert: () => insertChain }
      }),
    }

    const result = await createJobWithDedup(supabase as never, 'user-1', { projectId: 'proj-1', type: 'script' })
    expect(result).toBe(newJob)
  })

  it('throws 500 when the insert fails', async () => {
    const projectChain = makeChain({ data: { id: 'proj-1' } })
    const dedupChain = makeChain({ data: null })
    const insertChain = makeChain({ data: null, error: { message: 'db exploded' } })

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'projects') return projectChain
        return { select: () => dedupChain, insert: () => insertChain }
      }),
    }

    await expect(
      createJobWithDedup(supabase as never, 'user-1', { projectId: 'proj-1', type: 'script' }),
    ).rejects.toMatchObject({ statusCode: 500 })
  })
})

describe('getRetryableJob', () => {
  it('throws 404 when the job is missing or not owned', async () => {
    const supabase = { from: vi.fn(() => makeChain({ data: null, error: { message: 'not found' } })) }
    await expect(getRetryableJob(supabase as never, 'user-1', 'job-1')).rejects.toMatchObject({ statusCode: 404 })
  })

  it('throws 400 when the job is not in failed status', async () => {
    const supabase = { from: vi.fn(() => makeChain({ data: { id: 'job-1', status: 'completed' }, error: null })) }
    await expect(getRetryableJob(supabase as never, 'user-1', 'job-1')).rejects.toMatchObject({ statusCode: 400 })
  })

  it('returns the job when owned and failed', async () => {
    const job = { id: 'job-1', status: 'failed', project_id: 'proj-1', type: 'script' }
    const supabase = { from: vi.fn(() => makeChain({ data: job, error: null })) }
    const result = await getRetryableJob(supabase as never, 'user-1', 'job-1')
    expect(result).toBe(job)
  })
})
