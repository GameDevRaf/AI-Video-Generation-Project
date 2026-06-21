import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { extname, join } from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

export async function runFfmpeg(args: string[]) {
  try {
    await execFileAsync('ffmpeg', ['-hide_banner', '-loglevel', 'error', ...args], {
      maxBuffer: 1024 * 1024 * 20,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`ffmpeg failed: ${message}`)
  }
}

export async function transcodeVideoBufferToMp4(
  inputBuffer: Buffer,
  inputExtension: string,
): Promise<Buffer> {
  const dir = await mkdtemp(join(tmpdir(), 'ai-video-upload-'))
  try {
    const inputPath = join(dir, `input.${inputExtension || 'video'}`)
    const outputPath = join(dir, 'output.mp4')
    await writeFile(inputPath, inputBuffer)
    await runFfmpeg([
      '-y',
      '-i', inputPath,
      '-map', '0:v:0',
      '-map', '0:a?',
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-pix_fmt', 'yuv420p',
      '-c:a', 'aac',
      '-movflags', '+faststart',
      outputPath,
    ])
    return await readFile(outputPath)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

export async function downloadToFile(url: string, targetPath: string) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Failed to download media: ${response.status}`)
  await writeFile(targetPath, Buffer.from(await response.arrayBuffer()))
}

export function extensionFromUrl(url: string, fallback: string) {
  try {
    const path = new URL(url).pathname
    return extname(path).replace('.', '') || fallback
  } catch {
    return fallback
  }
}
