// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { parseJobError } from '../../../shared/utils/parseJobError'

// The exact Nano Banana / Gemini rate-limit message the worker stores (trimmed).
const GOOGLE_ERROR = 'Nano Banana (Gemini image) error 429: {'
  + '"error":{"code":429,"message":"You exceeded your current quota, please check your plan and billing details.",'
  + '"status":"RESOURCE_EXHAUSTED","details":[{"@type":"type.googleapis.com/google.rpc.RetryInfo","retryDelay":"20s"}]}}'

describe('parseJobError', () => {
  it('parses the Google/Gemini nested-JSON error into status / code / message', () => {
    const parsed = parseJobError(GOOGLE_ERROR)
    expect(parsed.status).toBe('RESOURCE_EXHAUSTED')
    expect(parsed.code).toBe(429)
    expect(parsed.message).toBe('You exceeded your current quota, please check your plan and billing details.')
  })

  it('derives the HTTP status name when a provider gives a code but no status (Stability)', () => {
    const parsed = parseJobError('Stability AI error 402: payment required')
    expect(parsed.code).toBe(402)
    expect(parsed.status).toBe('Payment Required')
    expect(parsed.message).toBe('payment required')
  })

  it('handles a leading-code SDK-style message', () => {
    const parsed = parseJobError('429 Rate limit reached for requests')
    expect(parsed.code).toBe(429)
    expect(parsed.status).toBe('Too Many Requests')
    expect(parsed.message).toBe('429 Rate limit reached for requests')
  })

  it('reads Anthropic-style embedded JSON (error.type as status, error.message as body)', () => {
    const msg = '{"type":"error","error":{"type":"rate_limit_error","message":"Number of requests exceeded"}}'
    const parsed = parseJobError(msg)
    expect(parsed.status).toBe('rate_limit_error')
    expect(parsed.message).toBe('Number of requests exceeded')
  })

  it('falls back cleanly when there is no code and no JSON (missing API key)', () => {
    const msg = 'No active API key found for provider "openai". Add one in Settings → API Keys.'
    const parsed = parseJobError(msg)
    expect(parsed.code).toBeUndefined()
    expect(parsed.status).toBeUndefined()
    expect(parsed.message).toBe(msg)
  })

  it('uses the whole string as the body for an opaque message', () => {
    const parsed = parseJobError('Something went wrong somewhere')
    expect(parsed.code).toBeUndefined()
    expect(parsed.status).toBeUndefined()
    expect(parsed.message).toBe('Something went wrong somewhere')
  })

  it('does not treat the raw JSON blob as the message body when JSON parsing succeeds', () => {
    const parsed = parseJobError(GOOGLE_ERROR)
    expect(parsed.message.startsWith('{')).toBe(false)
  })
})
