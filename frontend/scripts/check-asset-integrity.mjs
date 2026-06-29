#!/usr/bin/env node
/**
 * Guard de integridad visual de los assets del catálogo.
 *
 * El catálogo se pinta en slots de carta 2:3 (object-cover); un asset que no
 * sea 2:3 se recorta (caras/lados cortados) y uno de baja resolución se ve
 * borroso. Este script cruza personajes-seed.json + cartas-especiales.json
 * con las dimensiones REALES en disco (vía sharp) y reporta:
 *   - Retratos fuera de 2:3 (ratio ≠ 0.667 ± tolerancia)
 *   - Masters de baja resolución (lado mayor < MIN_LONG_SIDE)
 *   - Imágenes sin variante -1024 (rompería un srcset que la ofrezca)
 *   - Cartas especiales fuera de 2:3 o ausentes en disco
 *
 * Report-only por defecto (escribe el informe y sale 0, porque hay deuda
 * preexistente). Con --strict sale ≠0 si hay CUALQUIER hallazgo: úsalo en una
 * rama limpia tras saldar la deuda para que no reaparezca.
 *
 * Uso:  node scripts/check-asset-integrity.mjs [--strict]
 */
import sharp from 'sharp'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const FE = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const ROOT = resolve(FE, '..')
const SEED = join(ROOT, 'backend/src/main/resources/personajes-seed.json')
const ESPECIALES = join(ROOT, 'backend/src/main/resources/cartas-especiales.json')
const OUT = join(ROOT, 'private/qa/asset-integrity.md')

const TARGET_AR = 2 / 3 // 0.6667 — el slot de carta de toda la app
const AR_TOL = 0.073 // desviación tolerada (alinea con la auditoría: ~230 fuera)
const AR_TOL_SEVERE = 0.15 // recorte muy notorio (p.ej. Angel Beats ~0.91)
const MIN_LONG_SIDE = 1100 // los masters del catálogo son ~1024x1536
const STRICT = process.argv.includes('--strict')

const toDiskPathImg = (url) => (url ? join(FE, url.replace(/^\//, '')) : null)
const sib1024 = (p) => p.replace(/(?:-(?:300|600|1024))?\.webp$/i, '-1024.webp')

async function dims(path) {
  try {
    const m = await sharp(path).metadata()
    return m.width && m.height ? { w: m.width, h: m.height } : null
  } catch {
    return null
  }
}

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length)
  let i = 0
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (i < items.length) {
        const idx = i++
        out[idx] = await fn(items[idx], idx)
      }
    }),
  )
  return out
}

const seed = JSON.parse(readFileSync(SEED, 'utf8'))
const personajes = (Array.isArray(seed) ? seed : seed.personajes ?? []).map((p) => ({
  slug: p.slug, nombre: p.nombre, anime: p.anime, imagenUrl: p.imagenUrl ?? p.imagen ?? '',
}))

console.log(`Analizando ${personajes.length} retratos…`)
const offRatio = []
const lowRes = []
const missing1024 = []
const missingFile = []

await mapLimit(personajes, 16, async (p) => {
  const path = toDiskPathImg(p.imagenUrl)
  if (!path || !existsSync(path)) { if (p.imagenUrl) missingFile.push(p); return }
  const d = await dims(path)
  if (!d) { missingFile.push(p); return }
  const ar = d.w / d.h
  const dev = Math.abs(ar - TARGET_AR)
  if (dev > AR_TOL) offRatio.push({ ...p, ar: ar.toFixed(3), dev: dev.toFixed(3), severe: dev > AR_TOL_SEVERE, dim: `${d.w}x${d.h}` })
  if (Math.max(d.w, d.h) < MIN_LONG_SIDE) lowRes.push({ ...p, dim: `${d.w}x${d.h}` })
  if (/\.webp$/i.test(path) && !existsSync(sib1024(path))) missing1024.push(p)
})

// Cartas especiales (gacha): también deben ser 2:3 y existir.
let especiales = []
try { especiales = JSON.parse(readFileSync(ESPECIALES, 'utf8')) } catch { /* opcional */ }
const espOff = []
const espMissing = []
await mapLimit(especiales, 16, async (e) => {
  const url = e.arteUrl ?? e.imagenUrl
  if (!url) return
  const path = join(FE, 'public', url.replace(/^\//, ''))
  if (!existsSync(path)) { espMissing.push({ slug: e.slug, url }); return }
  const d = await dims(path)
  if (!d) { espMissing.push({ slug: e.slug, url }); return }
  const ar = d.w / d.h
  if (Math.abs(ar - TARGET_AR) > AR_TOL) espOff.push({ slug: e.slug, ar: ar.toFixed(3), dim: `${d.w}x${d.h}` })
})

offRatio.sort((a, b) => b.dev - a.dev)
const L = []
L.push('# Integridad visual de assets del catálogo', '', `> Generado: ${new Date().toISOString()}`, `> Slot objetivo 2:3 (${TARGET_AR.toFixed(3)}), tolerancia ±${AR_TOL}`, '')
L.push('## Resumen', '', '| Métrica | Valor |', '|---|---|')
L.push(`| Retratos | ${personajes.length} |`)
L.push(`| Fuera de 2:3 | ${offRatio.length} (${offRatio.filter((x) => x.severe).length} severos) |`)
L.push(`| Baja resolución (<${MIN_LONG_SIDE}px) | ${lowRes.length} |`)
L.push(`| Sin variante -1024 | ${missing1024.length} |`)
L.push(`| Archivo ausente/ilegible | ${missingFile.length} |`)
L.push(`| Cartas especiales fuera de 2:3 | ${espOff.length} |`)
L.push(`| Cartas especiales ausentes | ${espMissing.length} |`, '')
const sec = (t, rows) => { if (rows.length) { L.push(`## ${t} (${rows.length})`, ''); L.push(...rows, '') } }
sec('Retratos fuera de 2:3 (recorte de cara/lados)', offRatio.slice(0, 60).map((x) => `- ${x.severe ? '🔴' : '🟠'} \`${x.slug}\` (${x.anime}) ar=${x.ar} ${x.dim}`).concat(offRatio.length > 60 ? [`- … ${offRatio.length - 60} más`] : []))
sec('Masters de baja resolución (borrosos al ampliar)', lowRes.map((x) => `- \`${x.slug}\` (${x.anime}) ${x.dim}`))
sec('Sin variante -1024 (rompería un srcset que la pida)', missing1024.map((x) => `- \`${x.slug}\` → ${x.imagenUrl}`))
sec('Cartas especiales fuera de 2:3', espOff.map((x) => `- \`${x.slug}\` ar=${x.ar} ${x.dim}`))
sec('Cartas especiales ausentes en disco', espMissing.map((x) => `- \`${x.slug}\` → ${x.url}`))
sec('Archivo de retrato ausente/ilegible', missingFile.map((x) => `- \`${x.slug}\` → ${x.imagenUrl || '(vacío)'}`))

mkdirSync(dirname(OUT), { recursive: true })
writeFileSync(OUT, L.join('\n'))
const total = offRatio.length + lowRes.length + missing1024.length + missingFile.length + espOff.length + espMissing.length
console.log(`\nInforme: ${OUT}`)
console.log(`  fuera de 2:3: ${offRatio.length} (${offRatio.filter((x) => x.severe).length} severos)`)
console.log(`  baja resolución: ${lowRes.length}`)
console.log(`  sin -1024: ${missing1024.length}`)
console.log(`  especiales fuera de 2:3: ${espOff.length} · ausentes: ${espMissing.length}`)
console.log(`  archivo ausente: ${missingFile.length}`)
if (STRICT && total > 0) { console.error(`\n✗ --strict: ${total} hallazgos de integridad de assets`); process.exit(1) }
console.log(`\n✓ report-only (usa --strict para fallar en CI tras saldar la deuda)`)
