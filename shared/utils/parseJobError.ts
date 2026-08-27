// Parses a worker job's `error_message` (a plain string thrown by a provider
// adapter or the worker) into a structured shape for the notification toasts.
// Providers format failures inconsistently — some embed the raw provider JSON
// (Google/Gemini: `... error 429: {"error":{"code":429,"status":"...","message":"..."}}`),
// some throw `<Provider> error <code>: <text>`, some (SDKs) throw a leading-code
// string, and some throw a plain sentence with no code at all (e.g. the missing
// API-key message). This is a best-effort parser tolerant of all of those.
// Nuxt app code should use the built-in #shared alias; standalone worker code
// should use a relative path because it runs outside Nuxt's alias resolver.

export interface ParsedJobError {
  status?: string
  code?: number
  message: string
}

// Canonical HTTP status names, used to derive a heading when a provider gives a
// numeric code but no textual status of its own.
const HTTP_STATUS_TEXT: Record<number, string> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  402: 'Payment Required',
  403: 'Forbidden',
  404: 'Not Found',
  408: 'Request Timeout',
  409: 'Conflict',
  422: 'Unprocessable Entity',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
  502: 'Bad Gateway',
  503: 'Service Unavailable',
  504: 'Gateway Timeout',
}

/** Attempts to parse the first `{...}` JSON object embedded in the message. */
function extractEmbeddedError(text: string): { code?: number; status?: string; message?: string } | null {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end <= start) return null
  try {
    const parsed = JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>
    const err = (parsed.error ?? parsed) as Record<string, unknown>
    const code = typeof err.code === 'number' ? err.code : undefined
    // Google uses `status` (RESOURCE_EXHAUSTED); Anthropic uses `type` (rate_limit_error).
    const status = typeof err.status === 'string'
      ? err.status
      : typeof err.type === 'string' ? err.type : undefined
    const message = typeof err.message === 'string' ? err.message : undefined
    if (code === undefined && status === undefined && message === undefined) return null
    return { code, status, message }
  } catch {
    return null
  }
}

export function parseJobError(errorMessage: string): ParsedJobError {
  const raw = (errorMessage ?? '').trim()

  const embedded = extractEmbeddedError(raw)

  // code: embedded JSON → `... error <code>:` → leading `<code>` → none.
  let code = embedded?.code
  if (code === undefined) {
    const errorColon = raw.match(/error\s+(\d{3})\b/i)
    const leading = raw.match(/^(\d{3})\b/)
    const codeStr = errorColon?.[1] ?? leading?.[1]
    if (codeStr) code = Number(codeStr)
  }

  // message: embedded JSON message → text after `error <code>:` → whole string.
  let message = embedded?.message
  if (!message) {
    const afterColon = raw.match(/error\s+\d{3}:\s*([\s\S]+)/i)
    // Only use the after-colon capture when it isn't itself the embedded JSON blob.
    if (afterColon?.[1] && !afterColon[1].trimStart().startsWith('{')) {
      message = afterColon[1].trim()
    }
  }
  if (!message) message = raw

  // status: embedded status/type → HTTP canonical name for the code → none.
  const status = embedded?.status ?? (code !== undefined ? HTTP_STATUS_TEXT[code] : undefined)

  return { status, code, message }
}
