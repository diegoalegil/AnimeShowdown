#!/usr/bin/env node
// Prepara las ilustraciones de las cartas especiales igual que las de los
// personajes: <ruta>.webp (original), <ruta>-300.webp y <ruta>-600.webp, y
// anota en src/data/especiales.json la ruta sin extensión y el tono medio que
// se ve mientras carga la imagen.
//
// Necesita cwebp y dwebp (libwebp) en el PATH. Es idempotente: se puede volver
// a ejecutar tras añadir una especial nueva.
//
//   node scripts/generate-especiales.mjs
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..')
const archivoDatos = join(raiz, 'src/data/especiales.json')
const especiales = JSON.parse(readFileSync(archivoDatos, 'utf8'))

const ANCHOS = [300, 600]
const hex = (n) => Math.round(n).toString(16).padStart(2, '0')

/** Tono medio de la imagen: se reduce a 8 × 12 píxeles y se promedia. */
function tonoMedio(archivo) {
  const ppm = execFileSync('dwebp', ['-quiet', '-resize', '8', '12', '-ppm', archivo, '-o', '-'])
  // Cabecera P6: "P6\n8 12\n255\n" y después los píxeles RGB.
  let saltos = 0
  let inicio = 0
  while (saltos < 3) if (ppm[inicio++] === 0x0a) saltos++
  const suma = [0, 0, 0]
  const pixeles = (ppm.length - inicio) / 3
  for (let i = inicio; i < ppm.length; i += 3) {
    suma[0] += ppm[i]
    suma[1] += ppm[i + 1]
    suma[2] += ppm[i + 2]
  }
  return `#${suma.map((s) => hex(s / pixeles)).join('')}`
}

let generadas = 0
const resultado = especiales.map((especial) => {
  const ruta = especial.img.replace(/\.webp$/, '')
  const original = join(raiz, 'public', `${ruta}.webp`)
  if (!existsSync(original)) throw new Error(`No existe public/${ruta}.webp (${especial.id})`)
  for (const ancho of ANCHOS) {
    const destino = join(raiz, 'public', `${ruta}-${ancho}.webp`)
    if (existsSync(destino)) continue
    execFileSync('cwebp', ['-quiet', '-q', '80', '-m', '6', '-resize', String(ancho), '0', original, '-o', destino])
    generadas++
  }
  const { color, ...resto } = especial
  return { ...resto, img: ruta, color: color ?? tonoMedio(original) }
})

// Mismo formato que el resto del catálogo: una carta por línea.
writeFileSync(archivoDatos, `[\n${resultado.map((e) => `  ${JSON.stringify(e)}`).join(',\n')}\n]\n`)
console.log(`generate-especiales: ${generadas} imágenes nuevas, ${resultado.length} especiales anotadas`)
