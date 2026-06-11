#!/usr/bin/env node
// Genera los overlays atmosféricos pre-horneados que sustituyen a los
// SVG filters vivos (feTurbulence) del runtime. WebKit rasteriza esos
// filtros en CPU y, aplicados a áreas grandes (el body entero, heroes
// full-bleed), destrozan el presupuesto de composición de Safari: scroll
// con jank y descartes de tiles que pintan la pantalla en blanco.
//
// Salida (versionada en el nombre: el SW runtime-cachea /assets y un
// cambio de look necesita nombre nuevo para invalidar):
//   public/assets/overlays/film-grain-v1.png  — tile 128×128 de grano,
//     4 niveles de gris en paleta PNG (~2KB). Sustituye al data-URI con
//     feTurbulence de body::before.
//   public/assets/overlays/mist-fog-v1.webp   — banda 640×480 de niebla
//     blanca con alpha fbm, tileable en X para pannearla en loop con
//     transform. Sustituye al feTurbulence en loop de MistDrift.
//
// Determinista: PRNG mulberry32 con semilla fija — regenerar produce el
// mismo asset byte a byte (mismo patrón que galaxy-layout.js).
import { mkdir } from 'node:fs/promises'
import { dirname, resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FRONTEND = resolve(__dirname, '..')
const OUT_DIR = join(FRONTEND, 'public', 'assets', 'overlays')

function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/* ───────────────────────── grano de película ───────────────────────── */

async function generateGrain() {
  const SIZE = 128
  const LEVELS = [64, 128, 192, 255]
  const rng = mulberry32(0x515a1)
  const px = Buffer.alloc(SIZE * SIZE)
  for (let i = 0; i < px.length; i++) {
    px[i] = LEVELS[Math.floor(rng() * LEVELS.length)]
  }
  const out = join(OUT_DIR, 'film-grain-v1.png')
  await sharp(px, { raw: { width: SIZE, height: SIZE, channels: 1 } })
    .png({ palette: true, colours: 8, compressionLevel: 9, effort: 10 })
    .toFile(out)
  return out
}

/* ─────────────────────────── niebla fbm ─────────────────────────── */

// Value noise bilineal sobre lattice envuelto en X: el período horizontal
// es exactamente el ancho del tile → la costura del loop es invisible.
function makeLattice(cellsX, cellsY, rng) {
  const g = new Float32Array(cellsX * (cellsY + 1))
  for (let i = 0; i < g.length; i++) g[i] = rng()
  return (u, v) => {
    const x0 = Math.floor(u) % cellsX
    const x1 = (x0 + 1) % cellsX
    const y0 = Math.min(cellsY, Math.floor(v))
    const y1 = Math.min(cellsY, y0 + 1)
    const fx = u - Math.floor(u)
    const fy = v - Math.floor(v)
    const sx = fx * fx * (3 - 2 * fx)
    const sy = fy * fy * (3 - 2 * fy)
    const a = g[y0 * cellsX + x0]
    const b = g[y0 * cellsX + x1]
    const c = g[y1 * cellsX + x0]
    const d = g[y1 * cellsX + x1]
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy
  }
}

async function generateFog() {
  const W = 640
  const H = 480
  const OCTAVES = 4
  const BASE_X = 6 // celdas de la octava base (≈ baseFrequency 0.012 del SVG)
  const BASE_Y = 5
  const rng = mulberry32(0xf06)
  const octaves = Array.from({ length: OCTAVES }, (_, o) =>
    makeLattice(BASE_X << o, BASE_Y << o, rng),
  )
  const px = Buffer.alloc(W * H * 4)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let n = 0
      let amp = 0.5
      let total = 0
      for (let o = 0; o < OCTAVES; o++) {
        n += octaves[o]((x / W) * (BASE_X << o), (y / H) * (BASE_Y << o)) * amp
        total += amp
        amp *= 0.5
      }
      n /= total
      // Velo suave sin umbral (como el fractalNoise original): un leve
      // realce de contraste y techo de alpha — la intensidad final la pone
      // el consumidor (0.18-0.42), igual que hacía el rect del SVG.
      const a = Math.min(1, Math.max(0, (n - 0.5) * 1.4 + 0.5)) * 0.7
      const i = (y * W + x) * 4
      px[i] = 255
      px[i + 1] = 255
      px[i + 2] = 255
      px[i + 3] = Math.round(a * 255)
    }
  }
  const out = join(OUT_DIR, 'mist-fog-v1.webp')
  await sharp(px, { raw: { width: W, height: H, channels: 4 } })
    .webp({ quality: 60, alphaQuality: 65, effort: 6 })
    .toFile(out)
  return out
}

await mkdir(OUT_DIR, { recursive: true })
const files = [await generateGrain(), await generateFog()]
for (const f of files) {
  const { size } = await import('node:fs/promises').then((fs) => fs.stat(f))
  console.log(`${f.replace(FRONTEND + '/', '')} — ${(size / 1024).toFixed(1)}KB`)
}
