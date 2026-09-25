#!/usr/bin/env node
// Genera public/rayos.webp: un abanico de rayos de luz dorados (y alguno
// carmesí) que salen del centro y se apagan antes del borde. Lo usan los
// sobres: los focos del escenario, que se mecen despacio, y el estallido de
// luz detrás de una carta especial. El navegador solo lo gira, lo escala y
// cambia su opacidad; los rayos y su halo vienen pintados. Determinista.
//
// Necesita cwebp (libwebp) en el PATH.
//
//   node scripts/generate-rayos.mjs
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const LADO = 512
const CENTRO = LADO / 2
const RAYOS = 18
// Colores de la paleta (oro pálido, oro, carmesí claro) y su peso.
const COLORES = [
  { rgb: [247, 230, 162], peso: 0.55 },
  { rgb: [228, 195, 111], peso: 0.33 },
  { rgb: [232, 90, 100], peso: 0.12 },
]

let semilla = 0x6d2b79f5
/** Generador pseudoaleatorio xorshift32, en [0, 1). */
function azar() {
  semilla ^= semilla << 13
  semilla ^= semilla >>> 17
  semilla ^= semilla << 5
  return (semilla >>> 0) / 4294967296
}

function color() {
  let r = azar()
  for (const c of COLORES) {
    if ((r -= c.peso) < 0) return c.rgb
  }
  return COLORES[0].rgb
}

const rayos = Array.from({ length: RAYOS }, (_, i) => {
  const rgb = color()
  return {
    // Repartidos alrededor del centro con un poco de desorden.
    angulo: ((i + azar() * 0.6) / RAYOS) * 2 * Math.PI,
    // Haces anchos y suaves (luz de foco, no destellos de estrella).
    ancho: (2.2 + azar() * 5.5) * (Math.PI / 180),
    intensidad: (rgb[1] < 120 ? 0.22 : 0.3) + azar() * 0.3,
    largo: 0.7 + azar() * 0.3,
    rgb,
  }
})

const suavizar = (x) => x * x * (3 - 2 * x)
const entre = (v, a, b) => suavizar(Math.min(1, Math.max(0, (v - a) / (b - a))))

const rgba = Buffer.alloc(LADO * LADO * 4)
for (let y = 0; y < LADO; y++) {
  for (let x = 0; x < LADO; x++) {
    const dx = x + 0.5 - CENTRO
    const dy = y + 0.5 - CENTRO
    const r = Math.hypot(dx, dy) / CENTRO
    if (r >= 1) continue
    const angulo = Math.atan2(dy, dx)
    let transparencia = 1
    const luz = [0, 0, 0]
    for (const rayo of rayos) {
      let d = Math.abs(angulo - rayo.angulo) % (2 * Math.PI)
      if (d > Math.PI) d = 2 * Math.PI - d
      // Perfil gaussiano a lo ancho; nace cerca del centro y se apaga con la distancia.
      const a =
        Math.exp(-((d / rayo.ancho) ** 2)) *
        entre(r, 0.03, 0.16) *
        (1 - entre(r, 0.1, rayo.largo)) ** 1.1 *
        rayo.intensidad
      if (a < 0.002) continue
      for (let c = 0; c < 3; c++) luz[c] = luz[c] * (1 - a) + rayo.rgb[c] * a
      transparencia *= 1 - a
    }
    // Un halo suave en el centro, de donde nacen los rayos.
    const halo = Math.exp(-((r / 0.2) ** 2)) * 0.5
    for (let c = 0; c < 3; c++) luz[c] = luz[c] * (1 - halo) + COLORES[0].rgb[c] * halo
    transparencia *= 1 - halo
    const alfa = 1 - transparencia
    if (alfa <= 0) continue
    const i = (y * LADO + x) * 4
    for (let c = 0; c < 3; c++) rgba[i + c] = Math.round(Math.min(255, luz[c] / alfa))
    rgba[i + 3] = Math.round(alfa * 255)
  }
}

const temporal = mkdtempSync(join(tmpdir(), 'rayos-'))
const pam = join(temporal, 'rayos.pam')
const salida = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'rayos.webp')
try {
  writeFileSync(
    pam,
    Buffer.concat([Buffer.from(`P7\nWIDTH ${LADO}\nHEIGHT ${LADO}\nDEPTH 4\nMAXVAL 255\nTUPLTYPE RGB_ALPHA\nENDHDR\n`), rgba]),
  )
  execFileSync('cwebp', ['-quiet', '-q', '72', '-alpha_q', '85', '-m', '6', '-exact', pam, '-o', salida])
} finally {
  rmSync(temporal, { recursive: true, force: true })
}
console.log(`rayos.webp: ${LADO}×${LADO}, ${statSync(salida).size} bytes`)
