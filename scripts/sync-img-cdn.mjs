#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync, statSync } from 'node:fs'
import { dirname, extname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(__dirname, '..')
const sources = [
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
  : process.argv.includes('--aws-dry-run')
    ? 'aws-dry-run'
    : 'plan'

const cdnBaseUrl = normalizeCdnBaseUrl(
  process.env.ANIMESHOWDOWN_IMG_CDN_BASE_URL ||
    process.env.ANIMESHOWDOWN_IMAGE_CDN_BASE_URL,
)
const endpoint =
  process.env.R2_IMG_ENDPOINT ||
  process.env.R2_ENDPOINT
const accessKey =
  process.env.R2_IMG_ACCESS_KEY_ID ||
  process.env.R2_ACCESS_KEY_ID
const secretKey =
  process.env.R2_IMG_SECRET_ACCESS_KEY ||
  process.env.R2_SECRET_ACCESS_KEY
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
      out.push({
        fullPath,
        relativePath,
        size: statSync(fullPath).size,
        ext,
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

function syncSource(sourceDir, dryRun) {
  const args = [
    's3',
    'sync',
    sourceDir,
    destination,
    '--endpoint-url',
    endpoint,
    '--no-progress',
    '--cache-control',
    cacheControl,
    '--exclude',
    '*',
  ]
  for (const ext of extensions) {
    args.push('--include', `*${ext}`)
    args.push('--include', `*${ext.toUpperCase()}`)
  }
  if (dryRun) args.push('--dryrun')

  console.log(`\n$ aws ${args.map((arg) => (arg.includes(' ') ? `"${arg}"` : arg)).join(' ')}`)
  const result = spawnSync('aws', args, {
    stdio: 'inherit',
    env: {
      ...process.env,
      AWS_ACCESS_KEY_ID: accessKey,
      AWS_SECRET_ACCESS_KEY: secretKey,
      AWS_DEFAULT_REGION: process.env.AWS_DEFAULT_REGION || 'auto',
    },
  })
  if (result.error) {
    fail(`no se pudo ejecutar aws: ${result.error.message}`)
    return
  }
  if (result.status !== 0) {
    fail(`aws s3 sync fallo con codigo ${result.status}`)
  }
}

const sourceResults = sources.map((sourceDir) => ({
  sourceDir,
  files: walkImages(sourceDir),
}))
validateNoDuplicateRelativePaths(sourceResults)

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
  console.log(`${relative(repoRoot, sourceDir)}: ${files.length} archivo(s), ${formatBytes(bytes)}`)
}
console.log(`Total: ${totalFiles} archivo(s), ${formatBytes(totalBytes)}`)
for (const [ext, stats] of [...byExtension.entries()].sort()) {
  console.log(`  ${ext}: ${stats.files} archivo(s), ${formatBytes(stats.bytes)}`)
}
console.log('============================================================')

if (mode === 'plan') {
  console.log('Plan local OK. No se llamo a AWS ni se subio nada.')
  process.exit(process.exitCode || 0)
}

requireRemoteConfig()
if (process.exitCode) process.exit(process.exitCode)

const awsVersion = spawnSync('aws', ['--version'], { encoding: 'utf8' })
if (awsVersion.error || awsVersion.status !== 0) {
  fail('aws CLI no esta disponible en PATH')
  process.exit(process.exitCode)
}
console.log(awsVersion.stdout.trim() || awsVersion.stderr.trim())

for (const source of sourceResults) {
  syncSource(source.sourceDir, mode === 'aws-dry-run')
}

if (process.exitCode) process.exit(process.exitCode)
console.log(`\nImagenes ${mode === 'apply' ? 'sincronizadas' : 'validadas en dry-run'} correctamente.`)
