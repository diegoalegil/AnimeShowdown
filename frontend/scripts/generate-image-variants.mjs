#!/usr/bin/env node
// ===========================================================================
// generate-image-variants.mjs
//
// Para cada `frontend/img/<Anime>/<slug>.webp` genera variantes responsive:
//   <slug>-300.webp, <slug>-600.webp, <slug>-1024.webp
//   <slug>-300.avif, <slug>-600.avif, <slug>-1024.avif
//
// Idempotencia: si la variante existe y es igual o mas nueva que la fuente,
// se salta. Usa `--check` para auditar cobertura sin escribir archivos y
// `--strict` para que el check falle si hay variantes missing/stale.
// ===========================================================================

import { existsSync, readdirSync, statSync } from 'node:fs'
import { join, dirname, basename, extname, resolve, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __dirname = dirname(fileURLToPath(import.meta.url))
const IMG_DIR = resolve(__dirname, '..', 'img')
const args = new Set(process.argv.slice(2))
const CHECK_ONLY = args.has('--check') || args.has('--verify')
const STRICT = args.has('--strict')

const ANCHOS = [300, 600, 1024]
const FORMATOS = ['webp', 'avif']
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

function sample(kind, value) {
  if (samples[kind].length < 8) samples[kind].push(value)
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

function auditVariant(origen, destino) {
  const state = variantState(origen, destino)
  stats[state] += 1
  if (state === 'missing' || state === 'stale') {
    sample(state, variantLabel(destino))
  }
  return state
}

async function generar(origen, destino, ancho, formato) {
  const state = auditVariant(origen, destino)
  if (state === 'fresh') {
    stats.saltadas += 1
    return
  }
  if (CHECK_ONLY) return

  try {
    const pipeline = sharp(origen).resize(ancho, null, {
      withoutEnlargement: true,
      fit: 'inside',
    })
    if (formato === 'webp') {
      await pipeline.webp({ quality: WEBP_QUALITY, effort: 4 }).toFile(destino)
    } else {
      await pipeline.avif({ quality: AVIF_QUALITY, effort: 4 }).toFile(destino)
    }
    stats.generadas += 1
  } catch (err) {
    const msg = `${variantLabel(origen)} -> ${variantLabel(destino)}: ${err.message}`
    console.warn(`[img-variants] error procesando ${msg}`)
    stats.errores += 1
    sample('errores', msg)
  }
}

async function procesarFuente(fullPath) {
  stats.fuentes += 1
  for (const ancho of ANCHOS) {
    await Promise.all(
      FORMATOS.map((formato) =>
        generar(fullPath, variantPath(fullPath, ancho, formato), ancho, formato),
      ),
    )
  }
}

async function procesarDir(dir) {
  if (!existsSync(dir)) return
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
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

console.log(
  `[img-variants] empezando, fuente: ${IMG_DIR}, modo: ${CHECK_ONLY ? 'check' : 'write'}`,
)
const t0 = Date.now()
await procesarDir(IMG_DIR)
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
