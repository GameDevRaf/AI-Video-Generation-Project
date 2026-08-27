import { defineVitestConfig } from '@nuxt/test-utils/config'

export default defineVitestConfig({
  test: {
    globals: true,
    // Nuxt's generated test environment can take longer than 10 seconds to
    // bootstrap on a cold Windows checkout.
    hookTimeout: 30_000,
    // E2E specs are run by Playwright, not vitest
    exclude: ['tests/e2e/**', 'node_modules/**'],
    environmentMatchGlobs: [
      // Pure-Node tests: crypto, parsing, timestamps — no Nuxt context needed
      ['tests/unit/utils/**', 'node'],
      // Store tests need Vue auto-imports (ref, computed) → use nuxt env
      ['tests/unit/stores/**', 'nuxt'],
      // Provider adapter unit tests — node only (all HTTP mocked)
      ['tests/unit/providers/**', 'node'],
      // Worker handler integration tests run in node (all Nuxt deps are mocked)
      ['tests/integration/**', 'node'],
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: [
        'app/stores/**',
        'app/composables/**',
        'server/worker/handlers/**',
        'server/utils/**',
      ],
    },
  },
})
