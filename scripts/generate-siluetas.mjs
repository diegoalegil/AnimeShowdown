#!/usr/bin/env node
// Genera las siluetas del juego Silueta (public/img/siluetas/<id>.webp) a
// partir de una carpeta de recortes con transparencia, que no forma parte
// del repositorio: por cada <id>-300.webp (300 px de ancho) conserva el
// canal alfa y pinta el color de negro puro. No se ejecuta en el build.
//
// Solo se generan las de los personajes visibles del catálogo (personajes.json
// menos ocultas.json); los ids de los recortes se comparan sin distinguir
// mayúsculas (L → l). La lista de ids con silueta queda en
// src/juegos/silueta/disponibles.json, ordenada, para que el juego elija
// sus objetivos entre ellos.
//
// Peso: el alfa de los recortes viene con ruido (casi todo el interior es
// 254/253): se limpia (≥ 240 → 255, ≤ 8 → 0) y se reduce a 16 niveles, que
// a 300 px dan un borde igual de suave; después se prueba sin pérdida y con
// pérdida (-alpha_q) y se queda el archivo más ligero (~3 kB de media).
//
// Necesita cwebp y dwebp (libwebp) en el PATH.
//
//   node scripts/generate-siluetas.mjs <carpeta-de-recortes>
import { execFile } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { availableParallelism, tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const ejecutar = promisify(execFile)
const raiz = join(dirname(fileURLToPath(import.meta.url)), '..')
if (!process.argv[2]) {
  console.error('Uso: node scripts/generate-siluetas.mjs <carpeta-de-recortes>')
  process.exit(1)
}
const origen = resolve(process.argv[2])
const destino = join(raiz, 'public/img/siluetas')
const listado = join(raiz, 'src/juegos/silueta/disponibles.json')
const SUFIJO = '-300.webp'
const NIVELES_ALFA = 16
const ALFA_OPACO = 240
const ALFA_VACIO = 8

if (!existsSync(origen)) {
  console.error(`generate-siluetas: no existe la carpeta de recortes ${origen}`)
  process.exit(1)
}

function leerPam(archivo) {
  const datos = readFileSync(archivo)
  const texto = datos.toString('latin1', 0, 200)
  const fin = texto.indexOf('ENDHDR\n') + 'ENDHDR\n'.length
  return {
    ancho: +/WIDTH (\d+)/.exec(texto)[1],
    alto: +/HEIGHT (\d+)/.exec(texto)[1],
    canales: +/DEPTH (\d+)/.exec(texto)[1],
    pixeles: datos.subarray(fin),
  }
}

const escribirPam = (archivo, ancho, alto, pixeles) =>
  writeFileSync(
    archivo,
    Buffer.concat([Buffer.from(`P7\nWIDTH ${ancho}\nHEIGHT ${alto}\nDEPTH 4\nMAXVAL 255\nTUPLTYPE RGB_ALPHA\nENDHDR\n`), pixeles]),
  )

/** Alfa limpio y en NIVELES_ALFA escalones; el color, negro. */
function ennegrecer({ ancho, alto, canales, pixeles }) {
  const salida = Buffer.alloc(ancho * alto * 4)
  const paso = 255 / (NIVELES_ALFA - 1)
  for (let p = 0; p < ancho * alto; p++) {
    let a = canales === 4 ? pixeles[p * 4 + 3] : 255
    if (a >= ALFA_OPACO) a = 255
    else if (a <= ALFA_VACIO) a = 0
    else a = Math.round(Math.round(a / paso) * paso)
    salida[p * 4 + 3] = a
  }
  return salida
}

const temporal = mkdtempSync(join(tmpdir(), 'siluetas-'))

/** Genera la silueta de un recorte y devuelve su peso en bytes. */
async function silueta(archivo, id) {
  const pam = join(temporal, `${id}.pam`)
  await ejecutar('dwebp', ['-quiet', join(origen, archivo), '-pam', '-o', pam])
  const img = leerPam(pam)
  if (img.ancho > 300) throw new Error(`${archivo}: mide ${img.ancho} px de ancho (máximo 300)`)
  escribirPam(pam, img.ancho, img.alto, ennegrecer(img))

  const candidatos = [
    ['-lossless', '-z', '9'],
    ['-q', '0', '-alpha_q', '70', '-m', '6'],
  ]
  let mejor = null
  for (const [n, argumentos] of candidatos.entries()) {
    const salida = join(temporal, `${id}-${n}.webp`)
    await ejecutar('cwebp', ['-quiet', ...argumentos, pam, '-o', salida])
    const peso = statSync(salida).size
    if (!mejor || peso < mejor.peso) mejor = { salida, peso }
  }
  writeFileSync(join(destino, `${id}.webp`), readFileSync(mejor.salida))
  return mejor.peso
}

// Candidatos: personajes visibles con recorte.
const personajes = JSON.parse(readFileSync(join(raiz, 'src/data/personajes.json'), 'utf8'))
const ocultas = new Set(JSON.parse(readFileSync(join(raiz, 'src/data/ocultas.json'), 'utf8')).map((o) => o.id))
const recortes = new Map(
  readdirSync(origen)
    .filter((f) => f.endsWith(SUFIJO))
    .map((f) => [f.slice(0, -SUFIJO.length).toLowerCase(), f]),
)
const tareas = personajes.filter((p) => !ocultas.has(p.id) && recortes.has(p.id.toLowerCase())).map((p) => [recortes.get(p.id.toLowerCase()), p.id])

rmSync(destino, { recursive: true, force: true })
mkdirSync(destino, { recursive: true })

let total = 0
let mayor = { id: '', peso: 0 }
const pendientes = [...tareas]
async function trabajador() {
  while (pendientes.length) {
    const [archivo, id] = pendientes.shift()
    const peso = await silueta(archivo, id)
    total += peso
    if (peso > mayor.peso) mayor = { id, peso }
  }
}
try {
  await Promise.all(Array.from({ length: availableParallelism() }, trabajador))
} finally {
  rmSync(temporal, { recursive: true, force: true })
}

const ids = tareas.map(([, id]) => id).sort()
writeFileSync(listado, `${JSON.stringify(ids)}\n`)

const kB = (n) => `${(n / 1024).toFixed(1)} kB`
console.log(
  `generate-siluetas: ${ids.length} siluetas de ${personajes.length - ocultas.size} personajes visibles (${recortes.size} recortes), ` +
    `${(total / 1024 / 1024).toFixed(2)} MB en total, ${kB(total / ids.length)} de media, la mayor ${mayor.id} (${kB(mayor.peso)})`,
)
