#!/usr/bin/env node
// Tras el build: comprueba que el JavaScript inicial de la portada (el
// <script type="module"> de dist/index.html y sus modulepreload), sin el
// catálogo de cartas, no pasa de 100 kB comprimido con gzip. Si pasa, el
// build falla: una dependencia o una página más en el código inicial no
// deben colarse sin que nadie lo note. Las páginas que no son la portada se
// descargan aparte (ver src/paginas.js).
//
//   node scripts/check-size.mjs
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'

const LIMITE = 100_000
// El catálogo (src/data) crece con cada carta nueva y va en su propio archivo.
const FUERA = /\/catalogo-[\w-]+\.js$/

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..')
const dist = join(raiz, 'dist')
const base = process.env.BASE_PATH || '/'
const html = readFileSync(join(dist, 'index.html'), 'utf8')

const rutas = [
  ...html.matchAll(/<script type="module"[^>]*\ssrc="([^"]+)"/g),
  ...html.matchAll(/<link rel="modulepreload"[^>]*\shref="([^"]+)"/g),
].map(([, ruta]) => ruta)
if (!rutas.length) throw new Error('check-size: dist/index.html no pide ningún script')

let total = 0
const detalle = []
for (const ruta of rutas.filter((r) => !FUERA.test(r))) {
  if (!ruta.startsWith(base)) throw new Error(`check-size: ${ruta} no está bajo la base ${base}`)
  const bytes = gzipSync(readFileSync(join(dist, ruta.slice(base.length)))).length
  total += bytes
  detalle.push(`${ruta.split('/').pop()} ${(bytes / 1000).toFixed(1)} kB`)
}

const kb = (n) => `${(n / 1000).toFixed(1)} kB`
if (total > LIMITE) {
  console.error(`check-size: el JavaScript inicial pesa ${kb(total)} con gzip (límite ${kb(LIMITE)}): ${detalle.join(', ')}`)
  process.exit(1)
}
console.log(`check-size: JavaScript inicial ${kb(total)} con gzip (límite ${kb(LIMITE)}, sin el catálogo)`)
