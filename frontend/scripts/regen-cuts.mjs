#!/usr/bin/env node
// ===========================================================================
// regen-cuts.mjs  ·  Regeneración de recortes (figuras) en alta resolución
// ===========================================================================
//
// PROBLEMA: los recortes `frontend/img/cuts/<slug>.webp` están a 225x350 (y sus
// variantes -300/-600/-1024 eran COPIAS idénticas del mismo archivo pequeño).
// Por eso las figuras se ven pixeladas en toda la app. La resolución se mejora
// REGENERANDO el recorte, no con CSS ni con un srcset falso.
//
// MODOS:
//   - Upscaler IA (recomendado para detalle real): configúralo por env.
//   - Fallback sharp (Lanczos): NO recupera detalle, pero evita que el
//     navegador escale un 225px al vuelo. Es lo que se usó para el lote actual.
//
// SEGURIDAD:
//   - Por defecto procesa UN solo personaje (naruto) y escribe a un out-dir
//     aparte (no toca las fuentes). El masivo exige --all --aprobado.
//   - --overwrite sobreescribe las fuentes en img/cuts/ (vía archivo temporal
//     + rename atómico, para no corromper al leer y escribir el mismo path).
//
// ---------------------------------------------------------------------------
// USO
//   node scripts/regen-cuts.mjs                                   # POC naruto → out-dir
//   node scripts/regen-cuts.mjs --sharp-fallback --width 450 --quality 78
//   node scripts/regen-cuts.mjs --all --aprobado --sharp-fallback \
//        --overwrite --width 450 --quality 78                     # lote aplicado
//
// UPSCALER IA (por env):
//   ANIMESHOWDOWN_UPSCALER_BIN   binario (p.ej. realesrgan-ncnn-vulkan)
//   ANIMESHOWDOWN_UPSCALER_ARGS  plantilla de args con {in} y {out}
// ===========================================================================

import {
  existsSync,
  mkdirSync,
  readdirSync,
  writeFileSync,
  renameSync,
  rmSync,
} from 'node:fs'
import { join, dirname, resolve, basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import process from 'node:process'
import sharp from 'sharp'

const __dirname = dirname(fileURLToPath(import.meta.url))
const CUTS_DIR = resolve(__dirname, '..', 'img', 'cuts')
const DEFAULT_OUT_DIR = resolve(__dirname, '.regen-cuts-out')
const VARIANT_SUFFIX = /-(?:300|600|1024)$/

// Las figuras se muestran como mucho a ~320-360px de ancho; 450px cubre eso
// con margen para retina sin inflar el repo de más (decisión 2026-05-29).
const DEFAULT_WIDTH = 450
const DEFAULT_QUALITY = 78

function parseArgs(argv) {
  const args = {
    slugs: [],
    all: false,
    aprobado: false,
    sharpFallback: false,
    overwrite: false,
    width: DEFAULT_WIDTH,
    quality: DEFAULT_QUALITY,
    outDir: DEFAULT_OUT_DIR,
  }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--all') args.all = true
    else if (a === '--aprobado' || a === '--approved') args.aprobado = true
    else if (a === '--sharp-fallback') args.sharpFallback = true
    else if (a === '--overwrite') args.overwrite = true
    else if (a === '--slug') args.slugs.push(argv[++i])
    else if (a === '--width') args.width = parseInt(argv[++i], 10) || DEFAULT_WIDTH
    else if (a === '--quality') args.quality = parseInt(argv[++i], 10) || DEFAULT_QUALITY
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

  A) Upscaler IA local (recomendado). Ejemplo Real-ESRGAN:
       export ANIMESHOWDOWN_UPSCALER_BIN=realesrgan-ncnn-vulkan
       export ANIMESHOWDOWN_UPSCALER_ARGS="-i {in} -o {out} -s 4 -n realesrgan-x4plus-anime"
       node scripts/regen-cuts.mjs            # POC con naruto

  B) Fallback sharp (Lanczos, sin IA):
       node scripts/regen-cuts.mjs --sharp-fallback

Salida por defecto en: ${DEFAULT_OUT_DIR} (no toca las fuentes salvo --overwrite).
`)
  process.exit(0)
}

function upscaleConIA(inPath, outPath) {
  const bin = process.env.ANIMESHOWDOWN_UPSCALER_BIN
  const tpl = process.env.ANIMESHOWDOWN_UPSCALER_ARGS || '-i {in} -o {out}'
  const argList = tpl.split(/\s+/).map((t) => t.replace('{in}', inPath).replace('{out}', outPath))
  const res = spawnSync(bin, argList, { stdio: 'inherit' })
  if (res.status !== 0) throw new Error(`upscaler salió con código ${res.status}`)
}

async function upscaleConSharp(inPath, outPath, width, quality) {
  // toBuffer() antes de escribir: libera el handle de lectura, así que es
  // seguro aunque outPath termine siendo el mismo archivo fuente.
  const buf = await sharp(inPath)
    .resize({ width, kernel: 'lanczos3', withoutEnlargement: false })
    .sharpen()
    .webp({ quality })
    .toBuffer()
  writeFileSync(outPath, buf)
}

async function verificar(outPath, targetWidth) {
  const meta = await sharp(outPath).metadata()
  const ok = (meta.width ?? 0) >= targetWidth - 2
  return { ok, width: meta.width, height: meta.height }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const usandoIA = Boolean(process.env.ANIMESHOWDOWN_UPSCALER_BIN)

  if (!usandoIA && !args.sharpFallback) documentarUpscalerYsalir()

  let slugs = args.slugs.length > 0 ? args.slugs : ['naruto']
  if (args.all) {
    if (!args.aprobado) {
      console.error(
        '[regen-cuts] --all está BLOQUEADO. El masivo (~860 figuras) necesita\n' +
          'aprobación. Repite con: --all --aprobado',
      )
      process.exit(1)
    }
    slugs = listAllCutSlugs()
  }

  const destino = args.overwrite ? 'SOBREESCRIBE img/cuts/' : args.outDir
  console.log(
    `[regen-cuts] ${args.all ? 'MASIVO' : 'POC'} · ${slugs.length} recorte(s) · ` +
      `${usandoIA ? 'IA' : 'sharp'} · ${args.width}px q${args.quality} · destino: ${destino}`,
  )

  if (!args.overwrite) mkdirSync(args.outDir, { recursive: true })

  let okCount = 0
  let totalBytes = 0
  for (const slug of slugs) {
    const inPath = join(CUTS_DIR, `${slug}.webp`)
    if (!existsSync(inPath)) {
      console.warn(`[regen-cuts] No existe el recorte fuente: ${slug} — salto.`)
      continue
    }
    const finalPath = args.overwrite ? inPath : join(args.outDir, `${slug}.webp`)
    const tmpPath = `${finalPath}.regen.tmp`
    try {
      if (usandoIA) upscaleConIA(inPath, tmpPath)
      else await upscaleConSharp(inPath, tmpPath, args.width, args.quality)
      const v = await verificar(tmpPath, args.width)
      renameSync(tmpPath, finalPath)
      if (v.ok) okCount++
      else console.warn(`[regen-cuts] ${slug}: salió a ${v.width}px (< objetivo)`)
      totalBytes += (await sharp(finalPath).metadata()).size ?? 0
    } catch (err) {
      if (existsSync(tmpPath)) rmSync(tmpPath, { force: true })
      console.error(`[regen-cuts] Falló ${slug}: ${err.message}`)
    }
  }
  console.log(
    `[regen-cuts] Listo: ${okCount}/${slugs.length} ok` +
      (totalBytes ? ` · ~${(totalBytes / 1048576).toFixed(1)}MB generados` : ''),
  )
  if (!args.overwrite) {
    console.log('Revisa la salida y, si convence, vuelve a correr con --overwrite.')
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
