#!/usr/bin/env node
// ===========================================================================
// generate-cover-variants.mjs
//
// Genera variantes responsive + AVIF de las PORTADAS/BANNERS de
// frontend/public/assets/ que se renderizan como fondo (heroes, catalogs,
// banners de anime/torneo, covers de juegos/eventos). Para cada original:
//   <stem>-480.webp  <stem>-768.webp  <stem>-1280.webp
//   <stem>-480.avif  <stem>-768.avif  <stem>-1280.avif
//
// El componente <picture> (ResponsivePicture) las sirve con srcset+sizes para
// que móvil descargue 480/768 en vez del original 1600, y AVIF donde el
// navegador lo soporte (~25% menos que WebP).
//
// NO procesa los shells -bg.webp (VisualPageShell es procedural, no los pinta),
// ni cartas-especiales / fallbacks / empty-states (no son fondos responsive).
// Idempotente: salta la variante si existe y es >= mtime que la fuente.
//
// Uso:
//   node scripts/generate-cover-variants.mjs           # genera
//   node scripts/generate-cover-variants.mjs --check   # audita, no escribe
//   node scripts/generate-cover-variants.mjs --strict  # check que falla en CI
// ===========================================================================

import { existsSync, readdirSync, statSync } from 'node:fs'
import { join, dirname, basename, extname, resolve, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ASSETS_DIR = resolve(__dirname, '..', 'public', 'assets')
const args = new Set(process.argv.slice(2))
const CHECK_ONLY = args.has('--check') || args.has('--verify') || args.has('--strict')
const STRICT = args.has('--strict')

const WIDTHS = [480, 768, 1280]
const WEBP_QUALITY = 80
const AVIF_QUALITY = 50
const WEBP_EFFORT = 6
const AVIF_EFFORT = 4

// Carpetas de fondos responsive. brand/backgrounds entra SOLO para -hero/-catalog
// (los heroes que pinta CinematicHero); los -bg (shells procedurales) se excluyen.
const CATEGORY_PREFIXES = ['anime-banners/', 'tournament-banners/', 'game-covers/', 'event-covers/']

function rel(p) {
  return relative(ASSETS_DIR, p).split('\\').join('/')
}

function isRenderedCover(relPath) {
  if (CATEGORY_PREFIXES.some((p) => relPath.startsWith(p))) return true
  if (relPath.startsWith('brand/backgrounds/')) return /-(hero|catalog)\.webp$/i.test(relPath)
  return false
}

function isSourceOriginal(fileName) {
  if (extname(fileName).toLowerCase() !== '.webp') return false
  return !/-\d+$/.test(basename(fileName, '.webp'))
}

function variantPath(origen, ancho, formato) {
  const stem = basename(origen, extname(origen))
  return join(dirname(origen), `${stem}-${ancho}.${formato}`)
}

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) yield* walk(full)
    else if (isSourceOriginal(entry.name)) yield full
  }
}

const stats = { fuentes: 0, generadas: 0, fresh: 0, missing: 0, errores: 0 }
const missingSamples = []

for (const file of walk(ASSETS_DIR)) {
  const relPath = rel(file)
  if (!isRenderedCover(relPath)) continue
  stats.fuentes++
  let meta
  try {
    meta = await sharp(file).metadata()
  } catch (err) {
    stats.errores++
    console.error(`  ERROR meta ${relPath}: ${err.message}`)
    continue
  }
  const srcMtime = statSync(file).mtimeMs
  for (const ancho of WIDTHS) {
    if (meta.width && ancho >= meta.width) continue // no upscale
    for (const formato of ['webp', 'avif']) {
      const out = variantPath(file, ancho, formato)
      if (existsSync(out) && statSync(out).mtimeMs >= srcMtime) {
        stats.fresh++
        continue
      }
      stats.missing++
      if (missingSamples.length < 8) missingSamples.push(rel(out))
      if (CHECK_ONLY) continue
      try {
        const pipe = sharp(file).rotate().resize({ width: ancho, withoutEnlargement: true })
        if (formato === 'webp') {
          await pipe.webp({ quality: WEBP_QUALITY, effort: WEBP_EFFORT }).toFile(out)
        } else {
          await pipe.avif({ quality: AVIF_QUALITY, effort: AVIF_EFFORT }).toFile(out)
        }
        stats.generadas++
      } catch (err) {
        stats.errores++
        console.error(`  ERROR ${rel(out)}: ${err.message}`)
      }
    }
  }
}

console.log(
  `generate-cover-variants: fuentes=${stats.fuentes} generadas=${stats.generadas} ` +
    `fresh=${stats.fresh} missing=${stats.missing} errores=${stats.errores}`,
)
if (CHECK_ONLY && missingSamples.length > 0) {
  console.log('faltan (muestra):')
  for (const s of missingSamples) console.log(`  ${s}`)
}
if (stats.errores > 0) process.exit(1)
if (STRICT && stats.missing > 0) {
  console.error(`STRICT: ${stats.missing} variantes faltan o están stale`)
  process.exit(1)
}
