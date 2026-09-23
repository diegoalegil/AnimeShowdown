#!/usr/bin/env node
// Genera los tamaños de las ilustraciones de todas las cartas (personajes y
// especiales) a partir de su original: <ruta>-300.webp, -450 y -600 (ver
// scripts/imagenes.mjs). Solo crea los que faltan; con --rehacer=<ancho>
// vuelve a generar ese tamaño en todas las cartas (p. ej. tras cambiar su
// calidad).
//
// Necesita cwebp (libwebp) en el PATH.
//
//   node scripts/generate-tamanos.mjs [--rehacer=600]
import { execFile } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { availableParallelism } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { argumentosCwebp, TAMANOS } from './imagenes.mjs'

const ejecutar = promisify(execFile)
const raiz = join(dirname(fileURLToPath(import.meta.url)), '..')
const leer = (nombre) => JSON.parse(readFileSync(join(raiz, 'src/data', nombre), 'utf8'))
const rehacer = new Set(
  process.argv
    .filter((a) => a.startsWith('--rehacer='))
    .flatMap((a) => a.slice('--rehacer='.length).split(','))
    .map(Number),
)

const trabajos = []
for (const carta of [...leer('personajes.json'), ...leer('especiales.json')]) {
  const original = join(raiz, 'public', `${carta.img}.webp`)
  if (!existsSync(original)) throw new Error(`No existe public/${carta.img}.webp (${carta.id})`)
  for (const tamano of TAMANOS) {
    const destino = join(raiz, 'public', `${carta.img}-${tamano.ancho}.webp`)
    if (existsSync(destino) && !rehacer.has(tamano.ancho)) continue
    trabajos.push(argumentosCwebp(original, destino, tamano))
  }
}

let siguiente = 0
async function trabajador() {
  while (siguiente < trabajos.length) await ejecutar('cwebp', trabajos[siguiente++])
}
await Promise.all(Array.from({ length: availableParallelism() }, trabajador))
console.log(`generate-tamanos: ${trabajos.length} imágenes generadas`)
