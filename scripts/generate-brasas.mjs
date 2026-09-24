#!/usr/bin/env node
// Genera public/brasas.png: una tesela de brasas y motas de luz (oro, oro
// pálido y alguna carmesí) con su halo ya pintado, para las capas que suben
// despacio por la portada. El navegador solo desplaza la tesela (transform):
// ni filtros ni sombras en tiempo de ejecución. Se repite sin costuras (cada
// mota se dibuja también al otro lado del borde). Determinista.
//
//   node scripts/generate-brasas.mjs
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { pngRgba } from './png.mjs'

const LADO = 512
const MOTAS = 30
// Colores de la paleta (oro, oro pálido, carmesí claro) y su peso.
const COLORES = [
  { rgb: [228, 195, 111], peso: 0.5 },
  { rgb: [247, 230, 162], peso: 0.32 },
  { rgb: [232, 90, 100], peso: 0.18 },
]

let semilla = 0x2545f491
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

// Acumula luz premultiplicada y la opacidad por separado, y compone al final.
const luz = new Float32Array(LADO * LADO * 3)
const opacidad = new Float32Array(LADO * LADO)

function mota(cx, cy, nucleo, halo, rgb, intensidad) {
  const alcance = Math.ceil(nucleo + halo * 3)
  for (let dy = -alcance; dy <= alcance; dy++) {
    for (let dx = -alcance; dx <= alcance; dx++) {
      const d = Math.hypot(dx + 0.5 - (cx % 1), dy + 0.5 - (cy % 1))
      // Núcleo casi sólido y halo gaussiano.
      const a = Math.min(1, (d <= nucleo ? 1 : Math.exp(-(((d - nucleo) / halo) ** 2)) * 0.55) * intensidad)
      if (a < 0.004) continue
      const x = (((Math.floor(cx) + dx) % LADO) + LADO) % LADO
      const y = (((Math.floor(cy) + dy) % LADO) + LADO) % LADO
      const i = y * LADO + x
      const nueva = 1 - (1 - opacidad[i]) * (1 - a)
      for (let c = 0; c < 3; c++) luz[i * 3 + c] = luz[i * 3 + c] * (1 - a) + (rgb[c] / 255) * a
      opacidad[i] = nueva
    }
  }
}

for (let n = 0; n < MOTAS; n++) {
  const grande = azar() < 0.18
  const nucleo = grande ? 1.2 + azar() * 1.3 : 0.4 + azar() * 0.8
  const halo = grande ? 3 + azar() * 4 : 1.2 + azar() * 2
  mota(azar() * LADO, azar() * LADO, nucleo, halo, color(), 0.55 + azar() * 0.45)
}

const rgba = new Uint8Array(LADO * LADO * 4)
for (let i = 0; i < LADO * LADO; i++) {
  const a = opacidad[i]
  for (let c = 0; c < 3; c++) rgba[i * 4 + c] = a > 0 ? Math.round(Math.min(1, luz[i * 3 + c] / a) * 255) : 0
  rgba[i * 4 + 3] = Math.round(a * 255)
}

const png = pngRgba(LADO, LADO, rgba)
const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'brasas.png')
writeFileSync(out, png)
console.log(`brasas.png: ${LADO}×${LADO}, ${png.length} bytes`)
