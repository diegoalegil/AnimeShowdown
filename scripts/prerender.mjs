#!/usr/bin/env node
// Tras `vite build`: copia dist/index.html a cada ruta de la aplicación con su
// propio <title> y descripción, para que GitHub Pages sirva un 200 con
// metadatos correctos en /carta/<id>/, /sobres/ y /coleccion/. Escribe además
// dist/404.html para que cualquier otra ruta arranque la aplicación.
//
//   node scripts/prerender.mjs
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PAGINAS, descripcionCarta, nombreCarta, tituloDePagina } from '../src/lib/titulos.js'

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..')
const dist = join(raiz, 'dist')
const leerJson = (nombre) => JSON.parse(readFileSync(join(raiz, 'src/data', nombre), 'utf8'))

const escapar = (texto) =>
  String(texto).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

const plantilla = readFileSync(join(dist, 'index.html'), 'utf8')
for (const marca of ['<title>', 'name="description"', 'property="og:title"', 'property="og:description"']) {
  if (!plantilla.includes(marca)) throw new Error(`prerender: index.html no contiene ${marca}`)
}

/**
 * HTML de la plantilla con el título y la descripción de una página. Las
 * ilustraciones que precarga la portada (data-portada) solo sirven allí.
 */
function pagina(html, { titulo, descripcion }) {
  const t = escapar(titulo)
  const d = escapar(descripcion)
  // Reemplazos con función: el texto nunca se interpreta como patrón ($1, $&…).
  return html
    .replace(/\s*<link [^>]*data-portada[^>]*>/g, '')
    .replace(/<title>[^<]*<\/title>/, () => `<title>${t}</title>`)
    .replace(/(<meta name="description" content=")[^"]*"/, (_, a) => `${a}${d}"`)
    .replace(/(<meta property="og:title" content=")[^"]*"/, (_, a) => `${a}${t}"`)
    .replace(/(<meta property="og:description" content=")[^"]*"/, (_, a) => `${a}${d}"`)
}

function escribir(ruta, datos) {
  const destino = join(dist, ruta, 'index.html')
  mkdirSync(dirname(destino), { recursive: true })
  writeFileSync(destino, pagina(plantilla, datos))
}

const cartas = [...leerJson('personajes.json'), ...leerJson('especiales.json')]
for (const carta of cartas) {
  if (!/^[\w-]+$/.test(carta.id)) throw new Error(`prerender: id no apto para una ruta: ${carta.id}`)
  escribir(`carta/${carta.id}`, { titulo: tituloDePagina(nombreCarta(carta)), descripcion: descripcionCarta(carta) })
}
for (const clave of ['sobres', 'coleccion']) {
  escribir(clave, { titulo: tituloDePagina(PAGINAS[clave].titulo), descripcion: PAGINAS[clave].descripcion })
}
writeFileSync(
  join(dist, '404.html'),
  pagina(plantilla, { titulo: tituloDePagina('Página no encontrada'), descripcion: PAGINAS.galeria.descripcion }),
)

console.log(`prerender: ${cartas.length} fichas, 2 secciones y 404.html`)
