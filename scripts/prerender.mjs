#!/usr/bin/env node
// Tras `vite build`: copia dist/index.html a cada ruta de la aplicación con su
// propio <title> y descripción, para que GitHub Pages sirva un 200 con
// metadatos correctos en /carta/<id>/, /sobres/ y /coleccion/. Escribe además
// dist/404.html para que cualquier otra ruta arranque la aplicación.
//
// La portada (dist/index.html) lleva además su HTML ya pintado (ver
// src/esqueleto.jsx): la sala, el título y las acciones se ven sin esperar al
// JavaScript, que después lo hidrata. Las demás páginas arrancan vacías.
//
// Las fichas salen del mismo catálogo que usa la aplicación (src/lib/catalog.js).
//
//   node scripts/prerender.mjs
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import { ESCENARIOS, pieza } from '../src/lib/marca.js'
import { PAGINAS, descripcionCarta, nombreCarta, tituloDePagina } from '../src/lib/titulos.js'

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..')
const base = process.env.BASE_PATH || '/'
const dist = join(raiz, 'dist')

const escapar = (texto) =>
  String(texto).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

const plantilla = readFileSync(join(dist, 'index.html'), 'utf8')
for (const marca of ['<title>', 'name="description"', 'property="og:title"', 'property="og:description"']) {
  if (!plantilla.includes(marca)) throw new Error(`prerender: index.html no contiene ${marca}`)
}

/** <link> que precarga el escenario de una sección, igual que su <img> (sizes 100vw). */
function precargaEscenario(nombre) {
  const { srcSet } = pieza(nombre, base)
  return `<link rel="preload" as="image" type="image/webp" imagesrcset="${escapar(srcSet)}" imagesizes="100vw" fetchpriority="high">`
}

const trozos = readdirSync(join(dist, 'assets'))

/**
 * <link> que precarga el código de una página diferida (ver src/paginas.js):
 * al entrar directamente en ella se pide a la vez que el código inicial.
 */
function precargaCodigo(nombre) {
  const archivo = trozos.find((f) => f.startsWith(`${nombre}-`) && f.endsWith('.js'))
  if (!archivo) throw new Error(`prerender: no hay código ${nombre}-*.js en dist/assets`)
  return `<link rel="modulepreload" crossorigin href="${base}assets/${archivo}">`
}

/**
 * HTML de la plantilla con el título y la descripción de una página. Las
 * ilustraciones que precarga la portada (data-portada) solo sirven allí; una
 * sección puede precargar en su lugar su propio escenario y su código.
 */
function pagina(html, { titulo, descripcion, escenario, codigo }) {
  const t = escapar(titulo)
  const d = escapar(descripcion)
  const precargas = [escenario && precargaEscenario(escenario), codigo && precargaCodigo(codigo)].filter(Boolean)
  // Reemplazos con función: el texto nunca se interpreta como patrón ($1, $&…).
  return html
    .replace(/\s*<link [^>]*data-portada[^>]*>/g, '')
    .replace(/\n\s*<\/head>/, () => `\n${precargas.map((p) => `    ${p}\n`).join('')}  </head>`)
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

// Un servidor de Vite (sin red) carga los módulos de la aplicación: el
// catálogo, que importa los JSON, y la portada, que es JSX.
const vite = await createServer({
  root: raiz,
  base,
  logLevel: 'error',
  appType: 'custom',
  server: { middlewareMode: true, hmr: false, ws: false },
})
let catalogo, htmlPortada
try {
  ;({ catalogo } = await vite.ssrLoadModule('/src/lib/catalog.js'))
  // HTML de la portada, con la misma base que el build (ver src/esqueleto.jsx).
  htmlPortada = (await vite.ssrLoadModule('/src/esqueleto.jsx')).esqueletoPortada(base)
} finally {
  await vite.close()
}

const cartas = [...catalogo.personajes, ...catalogo.especiales]
for (const carta of cartas) {
  if (!/^[\w-]+$/.test(carta.id)) throw new Error(`prerender: id no apto para una ruta: ${carta.id}`)
  escribir(`carta/${carta.id}`, {
    titulo: tituloDePagina(nombreCarta(carta)),
    descripcion: descripcionCarta(carta),
    codigo: 'Ficha',
  })
}
for (const [clave, codigo] of [
  ['sobres', 'Sobres'],
  ['coleccion', 'Coleccion'],
]) {
  escribir(clave, {
    titulo: tituloDePagina(PAGINAS[clave].titulo),
    descripcion: PAGINAS[clave].descripcion,
    escenario: ESCENARIOS[clave],
    codigo,
  })
}
writeFileSync(
  join(dist, '404.html'),
  pagina(plantilla, { titulo: tituloDePagina('Página no encontrada'), descripcion: PAGINAS.galeria.descripcion }),
)

// React emite al principio las precargas de las imágenes prioritarias: van
// al <head>, salvo las que la plantilla ya tiene (la sala de la portada).
const [, precargas, cuerpo] = htmlPortada.match(/^((?:<link [^>]*>)*)([\s\S]*)$/)
const nuevas = (precargas.match(/<link [^>]*>/g) ?? []).filter((enlace) => {
  const srcset = enlace.match(/imageSrcSet="([^"]*)"/i)?.[1]
  return !srcset || !plantilla.includes(srcset)
})
if (!plantilla.includes('<div id="root"></div>')) throw new Error('prerender: index.html no tiene <div id="root"></div>')
writeFileSync(
  join(dist, 'index.html'),
  plantilla
    .replace(/\n\s*<\/head>/, () => `\n${nuevas.map((enlace) => `    ${enlace}\n`).join('')}  </head>`)
    .replace('<div id="root"></div>', () => `<div id="root">${cuerpo}</div>`),
)

console.log(`prerender: portada, ${cartas.length} fichas, 2 secciones y 404.html`)
