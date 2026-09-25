#!/usr/bin/env node
// Genera el arte de marca de public/img/marca (ver src/lib/marca.js) a partir
// de la carpeta de ilustraciones originales, que no forma parte del
// repositorio. No se ejecuta en el build: solo cuando cambia el arte.
//
// De la carpeta de origen lee, por cada anime con `marca` en animes.json,
// <marca>-scene-01.webp y <marca>-symbol-01.webp; además, las piezas de
// PIEZAS (<nombre>.webp, o su `origen` recortado) y el logo (logo.webp y logo.svg; si no están en
// la carpeta de origen se conservan los de public/img/marca).
//
// - Escenarios: 768 y 1280 px de ancho.
// - Fondo de la ficha: 480 px, difuminado y oscurecido hacia el color del
//   lienzo aquí mismo, para que el navegador no tenga que aplicar filtros.
// - Símbolos: 160 y 320 px. Los originales son opacos sobre negro; se les
//   da transparencia fuera del medallón (y en las zonas casi negras de las
//   esquinas) para que asienten sobre cualquier superficie oscura.
//
// Necesita cwebp y dwebp (libwebp) en el PATH.
//
//   node scripts/generate-marca.mjs <carpeta-de-originales>
import { execFile } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { availableParallelism, tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import {
  ANCHO_FONDO,
  ANCHOS_LOGO,
  ANCHOS_ESCENA,
  ANCHOS_SIMBOLO,
  CARPETA_MARCA,
  LOGO,
  PIEZAS,
  PROPORCION_ESCENA,
  archivosAnime,
  archivosComunes,
  rutaEscena,
  rutaFondo,
  rutaLogo,
  rutaPieza,
  rutaSimbolo,
} from '../src/lib/marca.js'

const ejecutar = promisify(execFile)
const raiz = join(dirname(fileURLToPath(import.meta.url)), '..')
if (!process.argv[2]) {
  console.error('Uso: node scripts/generate-marca.mjs <carpeta-de-originales>')
  process.exit(1)
}
const origen = resolve(process.argv[2])
const publico = (ruta) => join(raiz, 'public', ruta)
const temporal = mkdtempSync(join(tmpdir(), 'marca-'))

/** Calidad WebP por tipo de imagen: el escenario grande se ve a pantalla completa. */
const CALIDAD = { escena: { 768: 72, 1280: 78 }, pieza: 76, piezaMax: 68, fondo: 60, simbolo: 80 }

// Fondo: se reduce a la mitad del ancho final, se difumina (tres pasadas de
// caja ≈ gaussiana) y se mezcla con el color del lienzo (#04070c).
const FONDO_TRABAJO = ANCHO_FONDO / 2
const FONDO_RADIO = 5
const FONDO_LUZ = 0.42
const LIENZO = [4, 7, 12]

// Símbolo: opaco dentro del círculo inscrito (radio 0.5) y se desvanece hasta
// RADIO_FUERA; fuera de él, solo lo que tenga luz propia (luminancia).
const RADIO_DENTRO = 0.47
const RADIO_FUERA = 0.56
const LUMA_MIN = 24
const LUMA_MAX = 72

if (!existsSync(origen)) {
  console.error(`generate-marca: no existe la carpeta de origen ${origen}`)
  process.exit(1)
}

const cwebp = (entrada, salida, calidad, extra = []) =>
  ejecutar('cwebp', ['-quiet', '-q', String(calidad), '-m', '6', '-sharp_yuv', ...extra, entrada, '-o', salida])

function leerPnm(archivo) {
  const datos = readFileSync(archivo)
  const texto = datos.toString('latin1', 0, 200)
  if (texto.startsWith('P6')) {
    const m = /^P6\s+(\d+)\s+(\d+)\s+(\d+)\s/.exec(texto)
    return { ancho: +m[1], alto: +m[2], canales: 3, pixeles: datos.subarray(m[0].length) }
  }
  const fin = texto.indexOf('ENDHDR\n') + 'ENDHDR\n'.length
  const ancho = +/WIDTH (\d+)/.exec(texto)[1]
  const alto = +/HEIGHT (\d+)/.exec(texto)[1]
  return { ancho, alto, canales: +/DEPTH (\d+)/.exec(texto)[1], pixeles: datos.subarray(fin) }
}

const escribirPpm = (archivo, ancho, alto, pixeles) =>
  writeFileSync(archivo, Buffer.concat([Buffer.from(`P6\n${ancho} ${alto}\n255\n`), pixeles]))

const escribirPam = (archivo, ancho, alto, pixeles) =>
  writeFileSync(
    archivo,
    Buffer.concat([Buffer.from(`P7\nWIDTH ${ancho}\nHEIGHT ${alto}\nDEPTH 4\nMAXVAL 255\nTUPLTYPE RGB_ALPHA\nENDHDR\n`), pixeles]),
  )

/** Difuminado de caja horizontal y vertical (bordes replicados), en su sitio. */
function difuminar(pixeles, ancho, alto, radio) {
  const tmp = new Float32Array(pixeles.length)
  const pasada = (desde, hacia, largo, lineas, paso, salto) => {
    for (let l = 0; l < lineas; l++) {
      for (let c = 0; c < 3; c++) {
        for (let i = 0; i < largo; i++) {
          let suma = 0
          for (let k = -radio; k <= radio; k++) {
            const j = Math.min(largo - 1, Math.max(0, i + k))
            suma += desde[l * salto + j * paso + c]
          }
          hacia[l * salto + i * paso + c] = suma / (2 * radio + 1)
        }
      }
    }
  }
  const datos = Float32Array.from(pixeles)
  for (let n = 0; n < 3; n++) {
    pasada(datos, tmp, ancho, alto, 3, ancho * 3)
    pasada(tmp, datos, alto, ancho, ancho * 3, 3)
  }
  return datos
}

async function fondo(marca) {
  const alto = Math.round(FONDO_TRABAJO / PROPORCION_ESCENA)
  const ppm = join(temporal, `${marca}-fondo.ppm`)
  await ejecutar('dwebp', ['-quiet', join(origen, `${marca}-scene-01.webp`), '-resize', String(FONDO_TRABAJO), String(alto), '-ppm', '-o', ppm])
  const img = leerPnm(ppm)
  const suave = difuminar(img.pixeles, img.ancho, img.alto, FONDO_RADIO)
  const salida = Buffer.alloc(suave.length)
  for (let i = 0; i < suave.length; i++) salida[i] = Math.round(suave[i] * FONDO_LUZ + LIENZO[i % 3] * (1 - FONDO_LUZ))
  escribirPpm(ppm, img.ancho, img.alto, salida)
  await cwebp(ppm, publico(rutaFondo(marca)), CALIDAD.fondo, ['-resize', String(ANCHO_FONDO), '0'])
}

const suavizar = (x) => x * x * (3 - 2 * x)
const entre = (v, a, b) => suavizar(Math.min(1, Math.max(0, (v - a) / (b - a))))

async function simbolo(marca, ancho) {
  const pam = join(temporal, `${marca}-simbolo-${ancho}.pam`)
  await ejecutar('dwebp', ['-quiet', join(origen, `${marca}-symbol-01.webp`), '-resize', String(ancho), String(ancho), '-pam', '-o', pam])
  const img = leerPnm(pam)
  const p = img.pixeles
  const centro = (img.ancho - 1) / 2
  for (let y = 0; y < img.alto; y++) {
    for (let x = 0; x < img.ancho; x++) {
      const i = (y * img.ancho + x) * 4
      const r = Math.hypot(x - centro, y - centro) / img.ancho
      const medallon = 1 - entre(r, RADIO_DENTRO, RADIO_FUERA)
      const luz = entre(0.2126 * p[i] + 0.7152 * p[i + 1] + 0.0722 * p[i + 2], LUMA_MIN, LUMA_MAX)
      p[i + 3] = Math.round(255 * Math.max(medallon, luz))
    }
  }
  escribirPam(pam, img.ancho, img.alto, p)
  await cwebp(pam, publico(rutaSimbolo(marca, ancho)), CALIDAD.simbolo, ['-alpha_q', '90'])
}

const animes = JSON.parse(readFileSync(join(raiz, 'src/data/animes.json'), 'utf8')).filter((a) => a.marca)
const faltan = []
for (const { marca } of animes) {
  for (const tipo of ['scene', 'symbol']) {
    if (!existsSync(join(origen, `${marca}-${tipo}-01.webp`))) faltan.push(`${marca}-${tipo}-01.webp`)
  }
}
const fuentePieza = (nombre) => `${PIEZAS[nombre].origen ?? nombre}.webp`
for (const nombre of Object.keys(PIEZAS)) if (!existsSync(join(origen, fuentePieza(nombre)))) faltan.push(fuentePieza(nombre))
if (faltan.length) {
  console.error(`generate-marca: faltan en ${origen}:\n  ${faltan.join('\n  ')}`)
  process.exit(1)
}

mkdirSync(publico(CARPETA_MARCA), { recursive: true })
const trabajos = []
for (const { marca } of animes) {
  const escena = join(origen, `${marca}-scene-01.webp`)
  for (const ancho of ANCHOS_ESCENA) {
    trabajos.push(() => cwebp(escena, publico(rutaEscena(marca, ancho)), CALIDAD.escena[ancho], ['-resize', String(ancho), '0']))
  }
  trabajos.push(() => fondo(marca))
  for (const ancho of ANCHOS_SIMBOLO) trabajos.push(() => simbolo(marca, ancho))
}
for (const [nombre, { anchos, recorte }] of Object.entries(PIEZAS)) {
  const corte = recorte ? ['-crop', ...recorte.map(String)] : []
  for (const ancho of anchos) {
    const calidad = ancho > 1280 ? CALIDAD.piezaMax : CALIDAD.pieza
    trabajos.push(() =>
      cwebp(join(origen, fuentePieza(nombre)), publico(rutaPieza(nombre, ancho)), calidad, [...corte, '-resize', String(ancho), '0']),
    )
  }
}
for (const destino of [LOGO.webp, LOGO.svg]) {
  const fuente = join(origen, destino.split('/').at(-1))
  if (existsSync(fuente)) copyFileSync(fuente, publico(destino))
}

let siguiente = 0
async function trabajador() {
  while (siguiente < trabajos.length) await trabajos[siguiente++]()
}
// Versiones derivadas del logo, a partir del logo.webp ya copiado.
const derivadosLogo = () => [
  ...ANCHOS_LOGO.map((ancho) => () => cwebp(publico(LOGO.webp), publico(rutaLogo(ancho)), 88, ['-resize', String(ancho), String(ancho)])),
  ...[
    [LOGO.favicon, 64],
    [LOGO.tactil, 180],
  ].map(([destino, lado]) => () =>
    ejecutar('dwebp', ['-quiet', publico(LOGO.webp), '-resize', String(lado), String(lado), '-o', publico(destino)]),
  ),
]
try {
  await Promise.all(Array.from({ length: availableParallelism() }, trabajador))
  trabajos.push(...derivadosLogo())
  await Promise.all(Array.from({ length: availableParallelism() }, trabajador))
} finally {
  rmSync(temporal, { recursive: true, force: true })
}

const archivos = [...animes.flatMap((a) => archivosAnime(a.marca)), ...archivosComunes()]
const total = archivos.reduce((suma, ruta) => suma + (existsSync(publico(ruta)) ? statSync(publico(ruta)).size : 0), 0)
console.log(`generate-marca: ${trabajos.length} imágenes de ${animes.length} animes, ${archivos.length} archivos, ${(total / 1024 / 1024).toFixed(1)} MB`)
