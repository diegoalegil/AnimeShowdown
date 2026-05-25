#!/usr/bin/env node
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, extname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(__dirname, '..')
const personajesPath = resolve(
  repoRoot,
  'backend/src/main/resources/personajes-seed.json',
)
const torneosPath = resolve(
  repoRoot,
  'backend/src/main/resources/torneos-seed.json',
)
const outputPath = resolve(repoRoot, 'ASSET_MANIFEST.md')
const variantWidths = [300, 600, 1024]
const variantFormats = ['webp', 'avif']
const strict = process.argv.includes('--strict')

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function normalizePublicPath(value) {
  if (!value) return null
  const clean = String(value).trim().replace(/\\/g, '/')
  if (!clean.startsWith('/')) return `/${clean}`
  return clean
}

function publicPathToRepoPath(publicPath) {
  const normalized = normalizePublicPath(publicPath)
  if (!normalized) return null
  if (normalized.startsWith('/img/')) {
    return resolve(repoRoot, 'frontend', normalized.slice(1))
  }
  if (normalized.startsWith('/assets/')) {
    return resolve(repoRoot, 'frontend/public', normalized.slice(1))
  }
  return resolve(repoRoot, 'frontend/public', normalized.slice(1))
}

function repoPathForDisplay(path) {
  if (!path) return '(sin ruta)'
  return relative(repoRoot, path).replace(/\\/g, '/')
}

function slugify(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function variantsFor(path) {
  if (!path) return { label: '-', complete: false, total: 0, present: 0 }
  const ext = extname(path)
  if (!ext) return { label: '-', complete: false, total: 0, present: 0 }
  const stem = path.slice(0, -ext.length)
  const srcMtime = existsSync(path) ? statSync(path).mtimeMs : 0
  const details = []
  let present = 0
  let stale = 0
  for (const width of variantWidths) {
    for (const format of variantFormats) {
      const variantPath = `${stem}-${width}.${format}`
      if (!existsSync(variantPath)) {
        details.push(`${width}.${format}:missing`)
        continue
      }
      present += 1
      if (statSync(variantPath).mtimeMs < srcMtime) {
        stale += 1
        details.push(`${width}.${format}:stale`)
      }
    }
  }
  const total = variantWidths.length * variantFormats.length
  const label =
    stale > 0
      ? `${present}/${total} (${stale} stale)`
      : `${present}/${total}`
  return {
    label,
    complete: present === total && stale === 0,
    total,
    present,
    stale,
    details,
  }
}

function statusFor(path, { variants = false } = {}) {
  if (!path || !existsSync(path)) return { state: 'missing', variants: '-' }
  if (!variants) return { state: 'ok', variants: '-' }
  const variantState = variantsFor(path)
  return {
    state: variantState.complete ? 'ok' : 'partial',
    variants: variantState.label,
  }
}

function row(slug, category, path, options = {}) {
  const status = statusFor(path, options)
  return {
    slug,
    category,
    path: repoPathForDisplay(path),
    variants: status.variants,
    state: status.state,
  }
}

function addCharacterRows(rows, personaje) {
  const cardPath = publicPathToRepoPath(personaje.imagenUrl)
  const cardDir = cardPath ? dirname(cardPath) : null
  rows.push(row(personaje.slug, 'personaje-card', cardPath, { variants: true }))
  rows.push(
    row(
      personaje.slug,
      'personaje-portrait',
      cardDir ? join(cardDir, 'portraits', `${personaje.slug}.webp`) : null,
    ),
  )
  rows.push(
    row(
      personaje.slug,
      'personaje-banner',
      cardDir ? join(cardDir, 'banners', `${personaje.slug}.webp`) : null,
    ),
  )
}

function addAnimeRows(rows, personajes) {
  const animes = [...new Set(personajes.map((p) => p.anime).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b))
  for (const anime of animes) {
    const animeSlug = slugify(anime)
    rows.push(
      row(
        animeSlug,
        'anime-banner',
        resolve(repoRoot, 'frontend/public/assets/anime-banners', `${animeSlug}.webp`),
      ),
    )
  }
}

function addTournamentRows(rows, torneos) {
  for (const torneo of torneos) {
    rows.push(
      row(
        torneo.slug,
        'torneo-banner',
        resolve(
          repoRoot,
          'frontend/public/assets/tournament-banners',
          `${torneo.slug}.webp`,
        ),
      ),
    )
  }
}

function summarize(rows) {
  const byCategory = new Map()
  for (const item of rows) {
    const stats = byCategory.get(item.category) ?? {
      total: 0,
      ok: 0,
      partial: 0,
      missing: 0,
    }
    stats.total += 1
    stats[item.state] += 1
    byCategory.set(item.category, stats)
  }
  return [...byCategory.entries()].sort(([a], [b]) => a.localeCompare(b))
}

function table(rows) {
  const lines = [
    '| slug | categoria | ruta destino | variantes | estado |',
    '|---|---:|---|---:|---:|',
  ]
  for (const item of rows) {
    lines.push(
      `| ${item.slug} | ${item.category} | ${item.path} | ${item.variants} | ${item.state} |`,
    )
  }
  return lines.join('\n')
}

function summaryTable(summary) {
  const lines = [
    '| categoria | total | ok | partial | missing | cobertura |',
    '|---|---:|---:|---:|---:|---:|',
  ]
  for (const [category, stats] of summary) {
    const coverage = stats.total > 0
      ? `${Math.round((stats.ok / stats.total) * 1000) / 10}%`
      : '0%'
    lines.push(
      `| ${category} | ${stats.total} | ${stats.ok} | ${stats.partial} | ${stats.missing} | ${coverage} |`,
    )
  }
  return lines.join('\n')
}

const personajes = readJson(personajesPath)
const torneos = readJson(torneosPath)
const rows = []
for (const personaje of personajes) addCharacterRows(rows, personaje)
addAnimeRows(rows, personajes)
addTournamentRows(rows, torneos)

const summary = summarize(rows)
const content = `# AnimeShowdown Asset Manifest

Reporte local de cobertura de assets reales frente a los seeds del backend.

## Resumen

${summaryTable(summary)}

## Detalle

${table(rows)}
`

writeFileSync(outputPath, content, 'utf8')

const missing = rows.filter((item) => item.state === 'missing').length
const partial = rows.filter((item) => item.state === 'partial').length
console.log(`Asset manifest escrito en ${repoPathForDisplay(outputPath)}`)
console.log(`Filas: ${rows.length}. Missing: ${missing}. Partial: ${partial}.`)

if (strict && (missing > 0 || partial > 0)) {
  process.exitCode = 1
}
