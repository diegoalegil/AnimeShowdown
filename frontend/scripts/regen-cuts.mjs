#!/usr/bin/env node
// ===========================================================================
// regen-cuts.mjs  ·  Regeneración de recortes (figuras) en alta resolución
// ===========================================================================
//
// PROBLEMA: los recortes `frontend/img/cuts/<slug>.webp` están a 225x350 (y sus
// variantes -300/-600/-1024 son COPIAS idénticas del mismo archivo pequeño).
// Por eso las figuras se ven pixeladas en toda la app. La resolución se arregla
// REGENERANDO el recorte (upscale IA), no con CSS ni con un srcset falso.
//
// ESTE SCRIPT ESTÁ EN MODO POC A PROPÓSITO:
//   - Por defecto procesa UN solo personaje (naruto) y para.
//   - El procesado masivo (~1000 recortes) está BLOQUEADO tras un flag
//     explícito (--all --aprobado) para no consumir cómputo/coste sin que
//     Diego lo apruebe.
//   - NO instala modelos pesados. Usa el upscaler que tú configures por env;
//     si no hay ninguno, documenta cómo configurarlo y sale sin tocar nada.
//   - NO sobrescribe los archivos fuente: escribe a un directorio de salida
//     aparte (--out-dir) para que puedas inspeccionar el resultado antes de
//     decidir reemplazar el recorte original.
//
// ---------------------------------------------------------------------------
// USO
//   node scripts/regen-cuts.mjs                 # POC: regenera naruto a out-dir
//   node scripts/regen-cuts.mjs --slug zoro     # POC de otro slug
//   node scripts/regen-cuts.mjs --sharp-fallback # usa Lanczos de sharp (NO IA)
//   node scripts/regen-cuts.mjs --all --aprobado # masivo (requiere aprobación)
//
// UPSCALER IA (recomendado, configurable por env):
//   ANIMESHOWDOWN_UPSCALER_BIN   ruta al binario (p.ej. realesrgan-ncnn-vulkan)
//   ANIMESHOWDOWN_UPSCALER_ARGS  plantilla de args con {in} y {out}
//                                (p.ej. "-i {in} -o {out} -s 4 -n realesrgan-x4plus-anime")
// Si no defines BIN, el script documenta el setup y sale (salvo --sharp-fallback).
// ===========================================================================

import { existsSync, mkdirSync, readdirSync } from 'node:fs'
import { join, dirname, resolve, basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import process from 'node:process'
import sharp from 'sharp'

const __dirname = dirname(fileURLToPath(import.meta.url))
const CUTS_DIR = resolve(__dirname, '..', 'img', 'cuts')
const DEFAULT_OUT_DIR = resolve(__dirname, '.regen-cuts-out')
const VARIANT_SUFFIX = /-(?:300|600|1024)$/

// El recorte objetivo es una figura vertical tipo carta (~2:3). 900x1400
// cuadruplica el 225x350 actual manteniendo proporción.
const TARGET_WIDTH = 900
const MIN_ACEPTABLE_WIDTH = 600

function parseArgs(argv) {
  const args = { slugs: [], all: false, aprobado: false, sharpFallback: false, outDir: DEFAULT_OUT_DIR }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--all') args.all = true
    else if (a === '--aprobado' || a === '--approved') args.aprobado = true
    else if (a === '--sharp-fallback') args.sharpFallback = true
    else if (a === '--slug') args.slugs.push(argv[++i])
    else if (a === '--out-dir') args.outDir = resolve(argv[++i])
  }
  return args
}

function listAllCutSlugs() {
  if (!existsSync(CUTS_DIR)) return []
  return readdirSync(CUTS_DIR)
    .filter((f) => f.endsWith('.webp'))
    .map((f) => basename(f, '.webp'))
    .filter((slug) => !VARIANT_SUFFIX.test(slug))
    .sort()
}

function documentarUpscalerYsalir() {
  console.log(`
[regen-cuts] No hay upscaler IA configurado y no se pasó --sharp-fallback.

El script está LISTO pero no procesa nada para no degradar calidad ni instalar
modelos pesados sin tu permiso. Para regenerar de verdad, elige una opción:

  A) Upscaler IA local (recomendado para figuras anime). Ejemplo Real-ESRGAN:
       export ANIMESHOWDOWN_UPSCALER_BIN=realesrgan-ncnn-vulkan
       export ANIMESHOWDOWN_UPSCALER_ARGS="-i {in} -o {out} -s 4 -n realesrgan-x4plus-anime"
       node scripts/regen-cuts.mjs            # POC con naruto

  B) Fallback rápido sin IA (Lanczos de sharp, NO recupera detalle real):
       node scripts/regen-cuts.mjs --sharp-fallback

Salida en: ${DEFAULT_OUT_DIR} (no toca los recortes fuente).
`)
  process.exit(0)
}

async function upscaleConIA(inPath, outPath) {
  const bin = process.env.ANIMESHOWDOWN_UPSCALER_BIN
  const tpl = process.env.ANIMESHOWDOWN_UPSCALER_ARGS || '-i {in} -o {out}'
  const argList = tpl.split(/\s+/).map((t) => t.replace('{in}', inPath).replace('{out}', outPath))
  const res = spawnSync(bin, argList, { stdio: 'inherit' })
  if (res.status !== 0) throw new Error(`upscaler salió con código ${res.status}`)
}

async function upscaleConSharp(inPath, outPath) {
  // Lanczos3 + ligero realce. NO es IA: sirve como fallback para comparar,
  // no como solución final de calidad.
  await sharp(inPath)
    .resize({ width: TARGET_WIDTH, kernel: 'lanczos3', withoutEnlargement: false })
    .sharpen()
    .webp({ quality: 90 })
    .toFile(outPath)
}

async function verificar(outPath) {
  const meta = await sharp(outPath).metadata()
  const ok = (meta.width ?? 0) >= MIN_ACEPTABLE_WIDTH
  console.log(
    `[regen-cuts] ${basename(outPath)} → ${meta.width}x${meta.height} ${ok ? '✓' : '✗ (sigue bajo)'}`,
  )
  return ok
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const usandoIA = Boolean(process.env.ANIMESHOWDOWN_UPSCALER_BIN)

  if (!usandoIA && !args.sharpFallback) documentarUpscalerYsalir()

  let slugs = args.slugs.length > 0 ? args.slugs : ['naruto']
  if (args.all) {
    if (!args.aprobado) {
      console.error(
        '[regen-cuts] --all está BLOQUEADO. El masivo (~1000 figuras) consume\n' +
          'cómputo/coste y necesita aprobación de Diego. Repite con: --all --aprobado',
      )
      process.exit(1)
    }
    slugs = listAllCutSlugs()
    console.log(`[regen-cuts] MODO MASIVO aprobado: ${slugs.length} recortes.`)
  } else {
    console.log(`[regen-cuts] MODO POC: ${slugs.join(', ')} (sin tocar fuentes).`)
  }

  mkdirSync(args.outDir, { recursive: true })
  let okCount = 0
  for (const slug of slugs) {
    const inPath = join(CUTS_DIR, `${slug}.webp`)
    if (!existsSync(inPath)) {
      console.warn(`[regen-cuts] No existe el recorte fuente: ${inPath} — salto.`)
      continue
    }
    const outPath = join(args.outDir, `${slug}.webp`)
    try {
      if (usandoIA) await upscaleConIA(inPath, outPath)
      else await upscaleConSharp(inPath, outPath)
      if (await verificar(outPath)) okCount++
    } catch (err) {
      console.error(`[regen-cuts] Falló ${slug}: ${err.message}`)
    }
  }
  console.log(
    `[regen-cuts] Listo: ${okCount}/${slugs.length} ok en ${args.outDir}.\n` +
      'Revisa la salida y, si convence, reemplaza manualmente los recortes en img/cuts/.',
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
