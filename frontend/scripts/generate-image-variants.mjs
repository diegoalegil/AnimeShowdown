#!/usr/bin/env node
// ===========================================================================
// generate-image-variants.mjs
//
// Para cada `frontend/img/<Anime>/<slug>.webp` genera variantes responsive:
//   <slug>-300.webp, <slug>-600.webp
//
// Idempotencia: si la variante existe y es igual o mas nueva que la fuente,
// se salta. Usa `--check` para auditar cobertura sin escribir archivos y
// `--strict` para que el check falle si hay variantes missing/stale. En check
// mode estricto se valida contra un manifest de hashes commiteado: los mtimes
// de un checkout Git limpio y los bytes generados por libvips no son estables
// entre plataformas.
// ===========================================================================

import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join, dirname, basename, extname, resolve, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __dirname = dirname(fileURLToPath(import.meta.url))
const IMG_DIR = resolve(__dirname, '..', 'img')
const MANIFEST_PATH = resolve(__dirname, 'image-variants-manifest.json')
const args = new Set(process.argv.slice(2))
const CHECK_ONLY = args.has('--check') || args.has('--verify') || args.has('--strict')
const STRICT = args.has('--strict')

const MANIFEST_VERSION = 1
const ANCHOS = [300, 600]
const FORMATOS = ['webp']
const WEBP_QUALITY = 82
const AVIF_QUALITY = 50

const stats = {
  fuentes: 0,
  generadas: 0,
  saltadas: 0,
  fresh: 0,
  missing: 0,
  stale: 0,
  errores: 0,
}
const samples = {
  missing: [],
  stale: [],
  errores: [],
}
let manifest = null
const seenSources = new Set()
const seenVariants = new Set()
const nextManifest = CHECK_ONLY ? null : createManifest()

function sample(kind, value) {
  if (samples[kind].length < 8) samples[kind].push(value)
}

function createManifest() {
  return {
    version: MANIFEST_VERSION,
    widths: ANCHOS,
    formats: FORMATOS,
    quality: {
      webp: WEBP_QUALITY,
    },
    sources: {},
  }
}

function hashFile(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

function loadManifest() {
  if (!existsSync(MANIFEST_PATH)) {
    stats.errores += 1
    sample('errores', `${relative(__dirname, MANIFEST_PATH)} missing`)
    return null
  }
  try {
    return JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'))
  } catch (err) {
    stats.errores += 1
    sample('errores', `${relative(__dirname, MANIFEST_PATH)} invalid JSON: ${err.message}`)
    return null
  }
}

function sameArray(left, right) {
  return Array.isArray(left)
    && Array.isArray(right)
    && left.length === right.length
    && left.every((value, index) => value === right[index])
}

function validateManifestConfig() {
  if (!manifest) return
  if (
    manifest.version !== MANIFEST_VERSION ||
    !sameArray(manifest.widths, ANCHOS) ||
    !sameArray(manifest.formats, FORMATOS) ||
    manifest.quality?.webp !== WEBP_QUALITY
  ) {
    stats.errores += 1
    sample('errores', 'image-variants-manifest.json config does not match generator')
  }
}

function isSourceImage(fileName) {
  const ext = extname(fileName).toLowerCase()
  if (!['.webp', '.png', '.jpg', '.jpeg'].includes(ext)) return false
  return !/-\d+$/.test(basename(fileName, ext))
}

function variantPath(origen, ancho, formato) {
  const dir = dirname(origen)
  const stem = basename(origen, extname(origen))
  return join(dir, `${stem}-${ancho}.${formato}`)
}

function variantLabel(path) {
  return relative(IMG_DIR, path).replace(/\\/g, '/')
}

function variantState(origen, destino) {
  if (!existsSync(destino)) return 'missing'
  const srcM = statSync(origen).mtimeMs
  const dstM = statSync(destino).mtimeMs
  return dstM >= srcM ? 'fresh' : 'stale'
}

async function renderVariant(origen, ancho, formato) {
  const pipeline = sharp(origen).resize(ancho, null, {
    withoutEnlargement: true,
    fit: 'inside',
  })
  if (formato === 'webp') {
    return pipeline.webp({ quality: WEBP_QUALITY, effort: 4 }).toBuffer()
  }
  return pipeline.avif({ quality: AVIF_QUALITY, effort: 4 }).toBuffer()
}

function manifestVariantState(ctx, destino) {
  if (!manifest) return 'stale'

  const variantRel = variantLabel(destino)
  const sourceEntry = manifest.sources?.[ctx.sourceRel]
  if (!sourceEntry || sourceEntry.sha256 !== ctx.sourceHash) return 'stale'

  const variantEntry = sourceEntry.variants?.[variantRel]
  if (!variantEntry || variantEntry.sha256 !== hashFile(destino)) return 'stale'
  return 'fresh'
}

function recordManifestVariant(ctx, destino, ancho, formato) {
  if (!ctx.nextSourceEntry) return
  ctx.nextSourceEntry.variants[variantLabel(destino)] = {
    sha256: hashFile(destino),
    bytes: statSync(destino).size,
    width: ancho,
    format: formato,
  }
}

async function auditVariant(origen, destino, ancho, formato, ctx) {
  let state = 'fresh'
  if (!existsSync(destino)) {
    state = 'missing'
  } else if (CHECK_ONLY && STRICT) {
    state = manifestVariantState(ctx, destino)
  } else if (CHECK_ONLY) {
    const current = readFileSync(destino)
    const expected = await renderVariant(origen, ancho, formato)
    state = Buffer.compare(current, expected) === 0 ? 'fresh' : 'stale'
  } else {
    state = variantState(origen, destino)
  }

  stats[state] += 1
  if (state === 'missing' || state === 'stale') {
    sample(state, variantLabel(destino))
  }
  return state
}

async function generar(origen, destino, ancho, formato, ctx) {
  const state = await auditVariant(origen, destino, ancho, formato, ctx)
  if (state === 'fresh') {
    stats.saltadas += 1
    if (!CHECK_ONLY) recordManifestVariant(ctx, destino, ancho, formato)
    return
  }
  if (CHECK_ONLY) return

  try {
    writeFileSync(destino, await renderVariant(origen, ancho, formato))
    stats.generadas += 1
    recordManifestVariant(ctx, destino, ancho, formato)
  } catch (err) {
    const msg = `${variantLabel(origen)} -> ${variantLabel(destino)}: ${err.message}`
    console.warn(`[img-variants] error procesando ${msg}`)
    stats.errores += 1
    sample('errores', msg)
  }
}

async function procesarFuente(fullPath) {
  stats.fuentes += 1
  const sourceRel = variantLabel(fullPath)
  const sourceHash = hashFile(fullPath)
  seenSources.add(sourceRel)
  const nextSourceEntry = nextManifest
    ? { sha256: sourceHash, variants: {} }
    : null
  if (nextSourceEntry) {
    nextManifest.sources[sourceRel] = nextSourceEntry
  }
  const ctx = {
    sourceRel,
    sourceHash,
    nextSourceEntry,
  }
  for (const ancho of ANCHOS) {
    await Promise.all(
      FORMATOS.map((formato) => {
        const destino = variantPath(fullPath, ancho, formato)
        seenVariants.add(variantLabel(destino))
        return generar(fullPath, destino, ancho, formato, ctx)
      }),
    )
  }
}

async function procesarDir(dir) {
  if (!existsSync(dir)) return
  for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
    a.name.localeCompare(b.name)
  )) {
    if (entry.name === '.DS_Store') continue
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      await procesarDir(fullPath)
      continue
    }
    if (entry.isFile() && isSourceImage(entry.name)) {
      await procesarFuente(fullPath)
    }
  }
}

function printSamples(kind, label) {
  if (samples[kind].length === 0) return
  console.log(`[img-variants] ${label}: ${samples[kind].join(', ')}`)
}

function auditManifestExtras() {
  if (!manifest?.sources) return

  for (const [sourceRel, sourceEntry] of Object.entries(manifest.sources)) {
    if (!seenSources.has(sourceRel)) {
      stats.stale += 1
      sample('stale', `${sourceRel} (manifest source extra)`)
    }
    for (const variantRel of Object.keys(sourceEntry.variants ?? {})) {
      if (!seenVariants.has(variantRel)) {
        stats.stale += 1
        sample('stale', `${variantRel} (manifest variant extra)`)
      }
    }
  }
}

console.log(
  `[img-variants] empezando, fuente: ${IMG_DIR}, modo: ${CHECK_ONLY ? 'check' : 'write'}`,
)
if (CHECK_ONLY && STRICT) {
  manifest = loadManifest()
  validateManifestConfig()
}
const t0 = Date.now()
await procesarDir(IMG_DIR)
if (CHECK_ONLY && STRICT) {
  auditManifestExtras()
}
if (!CHECK_ONLY) {
  writeFileSync(MANIFEST_PATH, `${JSON.stringify(nextManifest, null, 2)}\n`)
}
const seg = ((Date.now() - t0) / 1000).toFixed(1)
const expected = stats.fuentes * ANCHOS.length * FORMATOS.length
console.log(
  `[img-variants] hecho en ${seg}s - fuentes=${stats.fuentes}, expected=${expected}, fresh=${stats.fresh}, missing=${stats.missing}, stale=${stats.stale}, generadas=${stats.generadas}, saltadas=${stats.saltadas}, errores=${stats.errores}`,
)
console.log(`[img-variants] widths=${ANCHOS.join(',')} formatos=${FORMATOS.join(',')}`)
printSamples('missing', 'missing sample')
printSamples('stale', 'stale sample')
printSamples('errores', 'error sample')

if (stats.errores > 0 || (STRICT && (stats.missing > 0 || stats.stale > 0))) {
  process.exit(1)
}
