#!/usr/bin/env node
// Genera public/grano.png: una tesela de ruido muy tenue (gris + alfa) que se
// pone encima de los focos de luz de los escenarios oscuros. El degradado
// entre dos negros tan cercanos solo tiene una veintena de niveles y se ven
// anillos; un punteado de ±2 niveles los disuelve. Es determinista: la misma
// semilla produce siempre el mismo archivo.
//
//   node scripts/generate-grano.mjs
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { pngGrisAlfa } from './png.mjs'

const SIZE = 64
let semilla = 0x9e3779b9

/** Generador pseudoaleatorio xorshift32, en [0, 1). */
function azar() {
  semilla ^= semilla << 13
  semilla ^= semilla >>> 17
  semilla ^= semilla << 5
  return (semilla >>> 0) / 4294967296
}

const gray = new Uint8Array(SIZE * SIZE)
const alpha = new Uint8Array(SIZE * SIZE)
for (let i = 0; i < SIZE * SIZE; i++) {
  // Mitad de los puntos aclaran, mitad oscurecen; alfa de 0 a 4 sobre 255.
  gray[i] = azar() < 0.5 ? 255 : 0
  alpha[i] = Math.floor(azar() * 5)
}

const png = pngGrisAlfa(SIZE, SIZE, gray, alpha)
const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'grano.png')
writeFileSync(out, png)
console.log(`grano.png: ${SIZE}×${SIZE}, ${png.length} bytes`)
