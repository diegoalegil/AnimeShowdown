#!/usr/bin/env node
// Prepara las ilustraciones de todas las cartas (personajes y especiales) a
// partir de su original:
//
// - genera <ruta>-300.webp, -450 y -600 (ver scripts/imagenes.mjs). Solo crea
//   los que faltan; con --rehacer=<ancho> vuelve a generar ese tamaño en todas
//   las cartas (p. ej. tras cambiar su calidad);
// - anota en src/data/*.json la proporción (`ar`, ancho / alto) de las que no
//   son 2:3, para enseñarlas enteras sin recortarlas.
//
// Necesita cwebp (libwebp) en el PATH.
//
//   node scripts/generate-tamanos.mjs [--rehacer=600]
import { execFile } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { availableParallelism } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { argumentosCwebp, campoProporcion, medidasWebp, TAMANOS } from './imagenes.mjs'

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
let anotadas = 0
for (const nombre of ['personajes.json', 'especiales.json']) {
  const cartas = leer(nombre).map((carta) => {
    const original = join(raiz, 'public', `${carta.img}.webp`)
    if (!existsSync(original)) throw new Error(`No existe public/${carta.img}.webp (${carta.id})`)
    for (const tamano of TAMANOS) {
      const destino = join(raiz, 'public', `${carta.img}-${tamano.ancho}.webp`)
      if (existsSync(destino) && !rehacer.has(tamano.ancho)) continue
      trabajos.push(argumentosCwebp(original, destino, tamano))
    }
    const { ar: _ar, ...resto } = carta
    const ar = campoProporcion(medidasWebp(original))
    if (ar !== undefined) anotadas++
    return ar === undefined ? resto : { ...resto, ar }
  })
  // Mismo formato que el resto del catálogo: una carta por línea.
  writeFileSync(join(raiz, 'src/data', nombre), `[\n${cartas.map((c) => `  ${JSON.stringify(c)}`).join(',\n')}\n]\n`)
}

let siguiente = 0
async function trabajador() {
  while (siguiente < trabajos.length) await ejecutar('cwebp', trabajos[siguiente++])
}
await Promise.all(Array.from({ length: availableParallelism() }, trabajador))
console.log(`generate-tamanos: ${trabajos.length} imágenes generadas, ${anotadas} cartas con proporción propia`)
