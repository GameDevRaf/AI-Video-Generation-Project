/**
 * Keep the runtime fetch function available on globalThis for app code and
 * tests that replace it with vi.stubGlobal('$fetch', ...).
 */
export default defineNuxtPlugin(() => {
  if (!globalThis.$fetch) {
    globalThis.$fetch = $fetch
  }
})
