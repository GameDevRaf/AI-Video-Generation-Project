import 'dotenv/config'

// Dynamic import ensures dotenv runs before any module reads process.env
async function main() {
  const { startWorkerLoop } = await import('./loop')
  startWorkerLoop()
}

main().catch(console.error)
