import { test, expect } from '@playwright/test'

/**
 * System tests: verify every API endpoint returns 401 when called without auth cookies.
 * These run against the live Nuxt dev server — no mocking.
 */

const PROTECTED_ENDPOINTS: Array<{ method: string; path: string; body?: Record<string, unknown> }> = [
  { method: 'GET', path: '/api/projects' },
  { method: 'POST', path: '/api/projects', body: { name: 'Test' } },
  { method: 'GET', path: '/api/jobs' },
  { method: 'POST', path: '/api/jobs', body: { projectId: 'x', type: 'script', input: {} } },
  { method: 'POST', path: '/api/jobs/x/retry', body: {} },
  { method: 'GET', path: '/api/settings' },
  { method: 'PATCH', path: '/api/settings', body: {} },
  { method: 'GET', path: '/api/provider/keys' },
  { method: 'POST', path: '/api/provider/keys', body: { provider: 'openai', secret: 'sk-test' } },
  { method: 'GET', path: '/api/exports', },
]

for (const endpoint of PROTECTED_ENDPOINTS) {
  test(`${endpoint.method} ${endpoint.path} → 401 without auth`, async ({ request }) => {
    const response = await request[endpoint.method.toLowerCase() as 'get' | 'post' | 'patch'](
      endpoint.path,
      endpoint.body ? { data: endpoint.body } : undefined,
    )
    expect(response.status()).toBe(401)
  })
}
