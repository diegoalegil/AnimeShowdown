#!/usr/bin/env node
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, extname, join, posix, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(__dirname, '..')
// SYNC_IMG_SOURCE_DIR: fuente alternativa para tandas que NO viven en git
// (p.ej. el banco de assets de marca, que llega vía GitHub Release y sube
// con el workflow brand-cdn-upload). El directorio replica la estructura
// del prefijo destino: <SOURCE_DIR>/brand/... → <bucket>/img/brand/...
const sources = process.env.SYNC_IMG_SOURCE_DIR
  ? [resolve(process.env.SYNC_IMG_SOURCE_DIR)]
  : [
      resolve(repoRoot, 'frontend/img'),
      resolve(repoRoot, 'frontend/public/img'),
    ]
const baseExtensions = ['.webp', '.png', '.jpg', '.jpeg', '.gif', '.svg']
const includeAvif =
  process.argv.includes('--include-avif') ||
  process.env.SYNC_IMG_INCLUDE_AVIF === 'true'
const extensions = includeAvif ? [...baseExtensions, '.avif'] : baseExtensions
const mode = process.argv.includes('--apply')
  ? 'apply'
  : process.argv.includes('--dry-run') || process.argv.includes('--aws-dry-run')
    ? 'dry-run'
    : 'plan'

const cdnBaseUrl = normalizeCdnBaseUrl(
  process.env.ANIMESHOWDOWN_IMG_CDN_BASE_URL ||
    process.env.ANIMESHOWDOWN_IMAGE_CDN_BASE_URL,
)
const endpoint = process.env.R2_IMG_ENDPOINT || process.env.R2_ENDPOINT
const accessKey = process.env.R2_IMG_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY_ID
const secretKey =
  process.env.R2_IMG_SECRET_ACCESS_KEY || process.env.R2_SECRET_ACCESS_KEY
const bucket = process.env.R2_IMG_BUCKET
const prefix = normalizePrefix(
  process.env.R2_IMG_PREFIX ??
    (cdnBaseUrl ? new URL(cdnBaseUrl).pathname : '/img'),
)
const destination = bucket ? `s3://${bucket}${prefix ? `/${prefix}` : ''}` : null
const cacheControl =
  process.env.R2_IMG_CACHE_CONTROL ||
  'public, max-age=3600, stale-while-revalidate=86400'

function fail(message) {
  console.error(`ERROR img cdn sync: ${message}`)
  process.exitCode = 1
}

function normalizeCdnBaseUrl(value) {
  const trimmed = value?.trim()
  if (!trimmed) return null
  try {
    const url = new URL(trimmed)
    if (url.protocol !== 'https:') {
      fail(`ANIMESHOWDOWN_IMG_CDN_BASE_URL debe usar https: ${trimmed}`)
      return null
    }
    return url.toString().replace(/\/+$/, '')
  } catch {
    fail(`ANIMESHOWDOWN_IMG_CDN_BASE_URL invalida: ${trimmed}`)
    return null
  }
}

function normalizePrefix(value) {
  return String(value || '')
    .replace(/^\/+|\/+$/g, '')
    .replace(/\/{2,}/g, '/')
}

function objectKey(relativePath) {
  return prefix ? posix.join(prefix, relativePath) : relativePath
}

function walkImages(sourceDir) {
  if (!existsSync(sourceDir)) return []
  const out = []
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === '.DS_Store') continue
      const fullPath = join(dir, entry.name)
      if (entry.isDirectory()) {
        walk(fullPath)
        continue
      }
      if (!entry.isFile()) continue
      const ext = extname(entry.name).toLowerCase()
      if (!extensions.includes(ext)) continue
      const relativePath = relative(sourceDir, fullPath).split(/[\\/]/).join('/')
      const bytes = readFileSync(fullPath)
      out.push({
        fullPath,
        relativePath,
        key: objectKey(relativePath),
        size: bytes.length,
        ext,
        sha256: createHash('sha256').update(bytes).digest('hex'),
        md5: createHash('md5').update(bytes).digest('hex'),
      })
    }
  }
  walk(sourceDir)
  return out
}

function formatBytes(bytes) {
  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  return `${value.toFixed(unit === 0 ? 0 : 1)}${units[unit]}`
}

function mimeType(file) {
  switch (file.ext) {
    case '.avif':
      return 'image/avif'
    case '.gif':
      return 'image/gif'
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg'
    case '.png':
      return 'image/png'
    case '.svg':
      return 'image/svg+xml'
    case '.webp':
      return 'image/webp'
    default:
      return 'application/octet-stream'
  }
}

function requireRemoteConfig() {
  const missing = []
  if (!cdnBaseUrl) missing.push('ANIMESHOWDOWN_IMG_CDN_BASE_URL')
  if (!endpoint) missing.push('R2_IMG_ENDPOINT')
  if (!accessKey) missing.push('R2_IMG_ACCESS_KEY_ID')
  if (!secretKey) missing.push('R2_IMG_SECRET_ACCESS_KEY')
  if (!bucket) missing.push('R2_IMG_BUCKET')
  if (missing.length > 0) {
    fail(`faltan variables para ${mode}: ${missing.join(', ')}`)
  }
}

function awsEnv() {
  return {
    ...process.env,
    AWS_ACCESS_KEY_ID: accessKey,
    AWS_SECRET_ACCESS_KEY: secretKey,
    AWS_DEFAULT_REGION: process.env.R2_REGION || 'auto',
  }
}

function aws(args, { inherit = false } = {}) {
  const result = spawnSync('aws', args, {
    encoding: inherit ? undefined : 'utf8',
    stdio: inherit ? 'inherit' : 'pipe',
    env: awsEnv(),
  })
  if (result.error) {
    return { ok: false, status: 1, stderr: result.error.message, stdout: '' }
  }
  return {
    ok: result.status === 0,
    status: result.status,
    stdout: result.stdout?.toString() ?? '',
    stderr: result.stderr?.toString() ?? '',
  }
}

function validateAwsCli() {
  const result = aws(['--version'])
  if (!result.ok) {
    fail('aws CLI no esta disponible en PATH')
    return
  }
  console.log((result.stdout || result.stderr).trim())
}

function validateNoDuplicateRelativePaths(sourceResults) {
  const seen = new Map()
  for (const { sourceDir, files } of sourceResults) {
    for (const file of files) {
      const previous = seen.get(file.relativePath)
      if (previous) {
        fail(
          `ruta duplicada bajo /img/${file.relativePath}: ${previous} y ${sourceDir}`,
        )
      } else {
        seen.set(file.relativePath, sourceDir)
      }
    }
  }
}

function headObject(file) {
  const result = aws([
    's3api',
    'head-object',
    '--bucket',
    bucket,
    '--key',
    file.key,
    '--endpoint-url',
    endpoint,
  ])
  if (result.ok) {
    try {
      return { state: 'found', body: JSON.parse(result.stdout) }
    } catch {
      return { state: 'error', message: `respuesta head-object invalida: ${file.key}` }
    }
  }
  const stderr = `${result.stderr}\n${result.stdout}`
  if (/Not Found|NoSuchKey|404|NotFound/i.test(stderr)) {
    return { state: 'missing' }
  }
  return { state: 'error', message: stderr.trim() || `head-object fallo: ${file.key}` }
}

function isRemoteCurrent(file, body) {
  const metadata = body?.Metadata ?? {}
  const remoteSha = metadata.sha256 || metadata['x-amz-meta-sha256']
  if (remoteSha && remoteSha === file.sha256) return true
  const etag = String(body?.ETag || '').replace(/"/g, '').toLowerCase()
  return etag === file.md5
}

function putObject(file) {
  return aws(
    [
      's3api',
      'put-object',
      '--bucket',
      bucket,
      '--key',
      file.key,
      '--body',
      file.fullPath,
      '--endpoint-url',
      endpoint,
      '--cache-control',
      cacheControl,
      '--content-type',
      mimeType(file),
      '--metadata',
      `sha256=${file.sha256}`,
    ],
    { inherit: false },
  )
}

function remotePlan(files) {
  const report = {
    uploaded: 0,
    planned: 0,
    skipped: 0,
    errors: [],
    uploadSamples: [],
    skipSamples: [],
  }
  for (const file of files) {
    const head = headObject(file)
    if (head.state === 'error') {
      report.errors.push(`${file.relativePath}: ${head.message}`)
      continue
    }
    const current = head.state === 'found' && isRemoteCurrent(file, head.body)
    if (current) {
      report.skipped += 1
      if (report.skipSamples.length < 8) report.skipSamples.push(file.relativePath)
      continue
    }
    report.planned += 1
    if (report.uploadSamples.length < 8) report.uploadSamples.push(file.relativePath)
    if (mode !== 'apply') continue
    const put = putObject(file)
    if (put.ok) {
      report.uploaded += 1
    } else {
      report.errors.push(
        `${file.relativePath}: ${put.stderr || put.stdout || `put-object codigo ${put.status}`}`,
      )
    }
  }
  return report
}

function printInventory(sourceResults) {
  const totalFiles = sourceResults.reduce((sum, source) => sum + source.files.length, 0)
  const totalBytes = sourceResults.reduce(
    (sum, source) => sum + source.files.reduce((inner, file) => inner + file.size, 0),
    0,
  )
  const byExtension = new Map()
  for (const { files } of sourceResults) {
    for (const file of files) {
      const stats = byExtension.get(file.ext) ?? { files: 0, bytes: 0 }
      stats.files += 1
      stats.bytes += file.size
      byExtension.set(file.ext, stats)
    }
  }

  console.log('============================================================')
  console.log('AnimeShowdown /img CDN sync')
  console.log(`Modo: ${mode}`)
  console.log(`CDN base: ${cdnBaseUrl || '(no configurado)'}`)
  console.log(`Destino: ${destination || '(no configurado)'}`)
  console.log(`Cache-Control: ${cacheControl}`)
  console.log(`Delete remoto: desactivado por seguridad`)
  console.log('------------------------------------------------------------')
  for (const { sourceDir, files } of sourceResults) {
    const bytes = files.reduce((sum, file) => sum + file.size, 0)
    console.log(
      `${relative(repoRoot, sourceDir)}: ${files.length} archivo(s), ${formatBytes(bytes)}`,
    )
  }
  console.log(`Total: ${totalFiles} archivo(s), ${formatBytes(totalBytes)}`)
  for (const [ext, stats] of [...byExtension.entries()].sort()) {
    console.log(`  ${ext}: ${stats.files} archivo(s), ${formatBytes(stats.bytes)}`)
  }
  console.log('============================================================')
}

function printRemoteReport(report) {
  console.log('------------------------------------------------------------')
  console.log(`Planned uploads: ${report.planned}`)
  console.log(`Uploaded: ${report.uploaded}`)
  console.log(`Skipped by hash: ${report.skipped}`)
  console.log(`Errors: ${report.errors.length}`)
  if (report.uploadSamples.length > 0) {
    console.log(`Upload sample: ${report.uploadSamples.join(', ')}`)
  }
  if (report.skipSamples.length > 0) {
    console.log(`Skip sample: ${report.skipSamples.join(', ')}`)
  }
  for (const error of report.errors.slice(0, 10)) {
    console.error(`ERROR ${error}`)
  }
  if (report.errors.length > 10) {
    console.error(`... ${report.errors.length - 10} error(es) mas`)
  }
}

const sourceResults = sources.map((sourceDir) => ({
  sourceDir,
  files: walkImages(sourceDir),
}))
validateNoDuplicateRelativePaths(sourceResults)
printInventory(sourceResults)

if (mode === 'plan') {
  console.log('Plan local OK. No se llamo a AWS ni se subio nada.')
  process.exit(process.exitCode || 0)
}

requireRemoteConfig()
if (process.exitCode) process.exit(process.exitCode)
validateAwsCli()
if (process.exitCode) process.exit(process.exitCode)

const files = sourceResults.flatMap((source) => source.files)
const report = remotePlan(files)
printRemoteReport(report)
if (report.errors.length > 0) process.exitCode = 1

if (process.exitCode) process.exit(process.exitCode)
console.log(
  mode === 'apply'
    ? '\nImagenes sincronizadas correctamente.'
    : '\nDry-run completado. No se subio nada.',
)
