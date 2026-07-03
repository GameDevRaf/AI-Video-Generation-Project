import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

const ROOT = process.cwd()
const CONTENT_DIR = path.join(ROOT, 'content')

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...await walk(fullPath))
      continue
    }

    if (entry.isFile() && entry.name.endsWith('.md')) {
      files.push(fullPath)
    }
  }

  return files
}

function toPosix(value) {
  return value.split(path.sep).join('/')
}

function stripNumericPrefix(segment) {
  return segment.replace(/^\d+\./, '')
}

function toRoute(filePath) {
  const relativePath = path.relative(CONTENT_DIR, filePath)
  const parts = relativePath.split(path.sep)
  const fileName = parts.pop()
  const cleanSegments = parts.map(stripNumericPrefix)
  const baseName = fileName.replace(/\.md$/, '')

  if (baseName === 'index') {
    return cleanSegments.length ? `/${cleanSegments.join('/')}` : '/'
  }

  cleanSegments.push(stripNumericPrefix(baseName))
  return `/${cleanSegments.join('/')}`
}

function parseFrontmatter(content) {
  if (!content.startsWith('---\n')) {
    return null
  }

  const endIndex = content.indexOf('\n---\n', 4)
  if (endIndex === -1) {
    return null
  }

  const raw = content.slice(4, endIndex)
  const data = {}

  for (const line of raw.split('\n')) {
    const match = line.match(/^([A-Za-z0-9_-]+):\s*(?:"(.*)"|(.*?))\s*$/)
    if (match) {
      data[match[1]] = (match[2] ?? match[3] ?? '').trim()
    }
  }

  return data
}

function stripCodeBlocks(content) {
  const lines = content.split('\n')
  const kept = []
  let fenceMarker = null

  for (const line of lines) {
    const trimmed = line.trim()
    const fenceMatch = trimmed.match(/^(`{3,})(.*)$/)

    if (fenceMatch) {
      const marker = fenceMatch[1]
      if (!fenceMarker) {
        fenceMarker = marker
      } else if (marker.length >= fenceMarker.length) {
        fenceMarker = null
      }
      continue
    }

    if (!fenceMarker) {
      kept.push(line)
    }
  }

  return kept.join('\n')
}

function hasBalancedCodeFences(content) {
  const lines = content.split('\n')
  let fenceMarker = null

  for (const line of lines) {
    const trimmed = line.trim()
    const fenceMatch = trimmed.match(/^(`{3,})(.*)$/)
    if (!fenceMatch) continue

    const marker = fenceMatch[1]
    if (!fenceMarker) {
      fenceMarker = marker
      continue
    }

    if (marker.length >= fenceMarker.length) {
      fenceMarker = null
    }
  }

  return fenceMarker === null
}

async function main() {
  const files = await walk(CONTENT_DIR)
  const errors = []
  const routes = new Map()

  for (const filePath of files) {
    const relativePath = toPosix(path.relative(ROOT, filePath))
    const content = await readFile(filePath, 'utf8')
    const proseContent = stripCodeBlocks(content)
    const frontmatter = parseFrontmatter(content)

    if (!frontmatter) {
      errors.push(`${relativePath}: missing valid frontmatter block`)
    } else {
      if (!frontmatter.title?.trim()) {
        errors.push(`${relativePath}: missing frontmatter title`)
      }
      if (!frontmatter.description?.trim()) {
        errors.push(`${relativePath}: missing frontmatter description`)
      }
    }

    const route = toRoute(filePath)
    const previous = routes.get(route)
    if (previous) {
      errors.push(`${relativePath}: route collision with ${previous} for ${route}`)
    } else {
      routes.set(route, relativePath)
    }

    if (/\]\((?:\.\.\/|\.\/)?(?:docs-site\/)?content\/.+?(?:\.md)?(?:#.*?)?\)/.test(proseContent)) {
      errors.push(`${relativePath}: contains source-file docs links; use route-style links instead`)
    }

    if (!hasBalancedCodeFences(content)) {
      errors.push(`${relativePath}: has an unbalanced triple-backtick fence`)
    }
  }

  if (errors.length) {
    console.error(`Docs check failed with ${errors.length} issue(s):`)
    for (const error of errors) {
      console.error(`- ${error}`)
    }
    process.exitCode = 1
    return
  }

  console.log(`Docs check passed: ${files.length} Markdown files, ${routes.size} routes validated.`)
}

await main()
