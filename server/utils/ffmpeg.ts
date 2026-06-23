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

/** Returns duration in seconds by running ffprobe on an already-on-disk file. Returns 0 on error. */
export async function getFileDurationSeconds(filePath: string): Promise<number> {
  try {
    const { stdout } = await execFileAsync('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'csv=p=0',
      filePath,
    ], { maxBuffer: 1024 * 1024 * 4 })
    return parseFloat(stdout.trim()) || 0
  } catch {
    return 0
  }
}

/** Returns duration in seconds by writing buffer to a temp file, then running ffprobe. */
export async function getBufferDurationSeconds(buffer: Buffer, ext: string): Promise<number> {
  const dir = await mkdtemp(join(tmpdir(), 'ai-video-probe-'))
  try {
    const filePath = join(dir, `input.${ext || 'bin'}`)
    await writeFile(filePath, buffer)
    return await getFileDurationSeconds(filePath)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}
