#!/usr/bin/env node
// ===========================================================================
// generate-image-variants.mjs — Variantes responsive + AVIF
//
// Para cada `frontend/img/<Anime>/<slug>.webp` genera:
//   <slug>-300.webp   (300px de ancho, calidad 82)
//   <slug>-600.webp   (600px, q 82)
//   <slug>-1024.webp  (1024px, q 82) — solo si la original es mayor
//   <slug>-300.avif   (300px, q 50; AVIF cunde más fuerte a baja Q)
//   <slug>-600.avif   (600px, q 50)
//   <slug>-1024.avif  (1024px, q 50)
//
// Las variantes se generan fuera del build normal. El workflow
// image-variants.yml corre sharp solo cuando cambia frontend/img/** y publica
// un artefacto reutilizable. Idempotente: si la variante ya existe y es más
// nueva que la fuente, no la regenera — así builds incrementales son rápidos.
//
// Salida típica para 700 imágenes desde cero: ~2-3 min con sharp en M1.
// Builds posteriores (cache hit) terminan en <2s.
// ===========================================================================

import { existsSync, readdirSync, statSync, mkdirSync } from 'node:fs'
import { join, dirname, basename, extname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __dirname = dirname(fileURLToPath(import.meta.url))
const IMG_DIR = resolve(__dirname, '..', 'img')

// Anchos objetivo y configuración por formato.
const ANCHOS = [300, 600, 1024]
const WEBP_QUALITY = 82
const AVIF_QUALITY = 50

let generadas = 0
let saltadas = 0
let errores = 0

/**
 * Genera una variante si no existe o es más antigua que la fuente.
 * @param {string} origen path absoluto a la imagen fuente.
 * @param {string} destino path absoluto al archivo destino.
 * @param {number} ancho objetivo en px (no upscale).
 * @param {'webp' | 'avif'} formato salida.
 */
async function generar(origen, destino, ancho, formato) {
  // Skip si la variante ya está al día (mismo o más nueva mtime).
  if (existsSync(destino)) {
    const srcM = statSync(origen).mtimeMs
    const dstM = statSync(destino).mtimeMs
    if (dstM >= srcM) {
      saltadas++
      return
    }
  }

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
    generadas++
  } catch (err) {
    console.warn(`[img-variants] error procesando ${origen}: ${err.message}`)
    errores++
  }
}

/**
 * Procesa todas las imágenes fuente del directorio. Una imagen "fuente" es
 * cualquier .webp/.png/.jpg que NO termine en -300/-600/-1024 (que sería
 * una variante ya generada).
 */
async function procesarDir(dir) {
  if (!existsSync(dir)) return
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '.DS_Store') continue
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      await procesarDir(fullPath)
      continue
    }
    const ext = extname(entry.name).toLowerCase()
    if (!['.webp', '.png', '.jpg', '.jpeg'].includes(ext)) continue

    const stem = basename(entry.name, ext)
    // Skip variantes ya generadas (no recursar variantes de variantes).
    if (/-\d+$/.test(stem)) continue

    for (const ancho of ANCHOS) {
      const destinoWebp = join(dir, `${stem}-${ancho}.webp`)
      const destinoAvif = join(dir, `${stem}-${ancho}.avif`)
      // Lanzamos en paralelo dentro de cada imagen — sharp ya usa threads
      // internos para encoding. Paralelizar más allá no acelera mucho y
      // satura memoria en runners pequeños.
      await Promise.all([
        generar(fullPath, destinoWebp, ancho, 'webp'),
        generar(fullPath, destinoAvif, ancho, 'avif'),
      ])
    }
  }
}

console.log(`[img-variants] empezando, fuente: ${IMG_DIR}`)
const t0 = Date.now()
await procesarDir(IMG_DIR)
const seg = ((Date.now() - t0) / 1000).toFixed(1)
console.log(
  `[img-variants] hecho en ${seg}s — generadas=${generadas}, saltadas=${saltadas}, errores=${errores}`,
)
if (errores > 0) process.exit(1)
