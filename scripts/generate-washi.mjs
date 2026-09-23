#!/usr/bin/env node
// Genera public/washi.png: una tesela pequeña de textura de papel (motas y
// fibras casi transparentes) que se repite como fondo. Es determinista: la
// misma semilla produce siempre el mismo archivo.
//
//   node scripts/generate-washi.mjs
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { pngGrisAlfa } from './png.mjs'

const SIZE = 96
const SEED = 0x5a5b1

function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const rng = mulberry32(SEED)
// Gris + alfa, 8 bits por canal.
const gray = new Uint8Array(SIZE * SIZE)
const alpha = new Uint8Array(SIZE * SIZE)
const put = (x, y, g, a) => {
  const i = ((y + SIZE) % SIZE) * SIZE + ((x + SIZE) % SIZE)
  if (a > alpha[i]) {
    gray[i] = g
    alpha[i] = a
  }
}

// Motas finas de tinta y de fibra clara.
for (let i = 0; i < SIZE * SIZE; i++) {
  const r = rng()
  if (r < 0.06) put(i % SIZE, Math.floor(i / SIZE), 40, 9 + Math.floor(rng() * 3) * 4)
  else if (r < 0.1) put(i % SIZE, Math.floor(i / SIZE), 255, 22)
}

// Fibras cortas y curvas, como las del papel hecho a mano.
for (let f = 0; f < 34; f++) {
  let x = rng() * SIZE
  let y = rng() * SIZE
  let angle = rng() * Math.PI * 2
  const length = 5 + Math.floor(rng() * 11)
  const light = rng() < 0.5
  for (let s = 0; s < length; s++) {
    put(Math.round(x), Math.round(y), light ? 255 : 70, light ? 26 : 12)
    angle += (rng() - 0.5) * 0.6
    x += Math.cos(angle)
    y += Math.sin(angle)
  }
}

const png = pngGrisAlfa(SIZE, SIZE, gray, alpha)

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'washi.png')
writeFileSync(out, png)
console.log(`washi.png: ${SIZE}×${SIZE}, ${png.length} bytes`)
