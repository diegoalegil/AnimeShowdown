#!/usr/bin/env node
// Genera public/washi.png: una tesela pequeña de textura de papel (motas y
// fibras casi transparentes) que se repite como fondo. Es determinista: la
// misma semilla produce siempre el mismo archivo.
//
//   node scripts/generate-washi.mjs
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { crc32, deflateSync } from 'node:zlib'

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

const raw = Buffer.alloc(SIZE * (SIZE * 2 + 1))
for (let y = 0; y < SIZE; y++) {
  const row = y * (SIZE * 2 + 1)
  raw[row] = 0 // sin filtro
  for (let x = 0; x < SIZE; x++) {
    raw[row + 1 + x * 2] = gray[y * SIZE + x]
    raw[row + 2 + x * 2] = alpha[y * SIZE + x]
  }
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

const ihdr = Buffer.alloc(13)
ihdr.writeUInt32BE(SIZE, 0)
ihdr.writeUInt32BE(SIZE, 4)
ihdr[8] = 8 // bits por canal
ihdr[9] = 4 // gris + alfa
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
])

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'washi.png')
writeFileSync(out, png)
console.log(`washi.png: ${SIZE}×${SIZE}, ${png.length} bytes`)
