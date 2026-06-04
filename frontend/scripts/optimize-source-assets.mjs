#!/usr/bin/env node
// ===========================================================================
// optimize-source-assets.mjs
//
// Recomprime IN-PLACE los .webp ORIGINALES de frontend/public/assets/ que están
// sobredimensionados. Estos assets (banners de anime/torneo, heroes, catalogs,
// covers, backgrounds de marca) se servían a 3318–4096 px de ancho cuando
// ninguna pantalla los pinta a más de ~1600 px → MB muertos en cada ruta.
//
// Regla de seguridad / idempotencia: SOLO se toca un archivo si su ancho supera
// el cap de su categoría. Re-encodear a la misma calidad un webp ya optimizado
// degradaría por generación, así que los archivos ya dentro del cap NO se tocan
// (el script es repetible sin pérdida acumulada). Nunca se reemplaza por una
// versión más grande que la original.
//
// NO toca las variantes responsive (-300/-480/…); las genera otro script
// (generate-image-variants.mjs). NO toca frontend/img/ (personajes).
//
// Uso:
//   node scripts/optimize-source-assets.mjs            # optimiza in-place
//   node scripts/optimize-source-assets.mjs --check    # audita, no escribe
// ===========================================================================

import { readdirSync, statSync, renameSync, rmSync } from 'node:fs'
import { join, dirname, basename, extname, resolve, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ASSETS_DIR = resolve(__dirname, '..', 'public', 'assets')
const args = new Set(process.argv.slice(2))
const CHECK_ONLY = args.has('--check') || args.has('--verify')

// Calidad equilibrada: q80 webp es visualmente casi indistinguible para arte
// fotográfico/ilustrado a tamaño de fondo/banner, con gran ahorro de bytes.
const WEBP_QUALITY = 80
const WEBP_EFFORT = 6

// Cap de ancho por categoría. Los shells de marca (-bg) NO se renderizan hoy
// (VisualPageShell es procedural; visual.shellImage no se pinta), así que se
// recortan agresivamente: peso de deploy sin riesgo visual.
const CAP_DEFAULT = 1600
const CAP_DEAD_SHELL = 1024

function isDeadShell(relPath) {
  return relPath.includes('brand/backgrounds/') && /-bg\.webp$/i.test(relPath)
}

function capFor(relPath) {
  return isDeadShell(relPath) ? CAP_DEAD_SHELL : CAP_DEFAULT
}

function isOptimizableOriginal(fileName) {
  if (extname(fileName).toLowerCase() !== '.webp') return false
  // Excluir variantes responsive ya generadas (nombre-300.webp, etc.).
  return !/-\d+$/.test(basename(fileName, '.webp'))
}

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) yield* walk(full)
    else if (isOptimizableOriginal(entry.name)) yield full
  }
}

const stats = { vistos: 0, optimizados: 0, saltados: 0, errores: 0 }
let bytesAntes = 0
let bytesDespues = 0
const cambios = []

for (const file of walk(ASSETS_DIR)) {
  stats.vistos++
  const relPath = relative(ASSETS_DIR, file).split('\\').join('/')
  try {
    const sizeAntes = statSync(file).size
    const meta = await sharp(file).metadata()
    const cap = capFor(relPath)
    if (!meta.width || meta.width <= cap) {
      stats.saltados++
      continue
    }
    if (CHECK_ONLY) {
      stats.optimizados++
      cambios.push(`  ${relPath}  ${meta.width}px → ${cap}px`)
      continue
    }
    const tmp = file + '.opt.tmp'
    await sharp(file)
      .rotate()
      .resize({ width: cap, withoutEnlargement: true })
      .webp({ quality: WEBP_QUALITY, effort: WEBP_EFFORT })
      .toFile(tmp)
    const sizeDespues = statSync(tmp).size
    // Nunca empeorar: si la recompresión saliera mayor, descartar.
    if (sizeDespues >= sizeAntes) {
      rmSync(tmp)
      stats.saltados++
      continue
    }
    renameSync(tmp, file)
    stats.optimizados++
    bytesAntes += sizeAntes
    bytesDespues += sizeDespues
    cambios.push(
      `  ${relPath}  ${meta.width}px ${(sizeAntes / 1024).toFixed(0)}KB → ${cap}px ${(sizeDespues / 1024).toFixed(0)}KB`,
    )
  } catch (err) {
    stats.errores++
    console.error(`  ERROR ${relPath}: ${err.message}`)
  }
}

console.log(cambios.join('\n'))
console.log(
  `\noptimize-source-assets: vistos=${stats.vistos} optimizados=${stats.optimizados} ` +
    `saltados=${stats.saltados} errores=${stats.errores}`,
)
if (!CHECK_ONLY && stats.optimizados > 0) {
  const ahorro = (bytesAntes - bytesDespues) / (1024 * 1024)
  console.log(
    `ahorro: ${(bytesAntes / 1024 / 1024).toFixed(1)}MB → ${(bytesDespues / 1024 / 1024).toFixed(1)}MB ` +
      `(−${ahorro.toFixed(1)}MB)`,
  )
}
if (stats.errores > 0) process.exit(1)
