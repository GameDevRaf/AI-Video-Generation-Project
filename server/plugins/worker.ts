export default defineNitroPlugin(async () => {
  try {
    const { startWorkerLoop } = await import('../worker/loop')
    startWorkerLoop()
  } catch (err) {
    console.error('[worker] Failed to start:', err instanceof Error ? err.message : err)
  }
})
