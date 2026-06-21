import { defineVitestConfig } from '@nuxt/test-utils/config'

export default defineVitestConfig({
  test: {
    globals: true,
    // E2E specs are run by Playwright, not vitest
    exclude: ['tests/e2e/**', 'node_modules/**'],
    environmentMatchGlobs: [
      // Pure-Node tests: crypto, parsing, timestamps — no Nuxt context needed
      ['tests/unit/utils/**', 'node'],
      // Store tests need Vue auto-imports (ref, computed) → use nuxt env
      ['tests/unit/stores/**', 'nuxt'],
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
