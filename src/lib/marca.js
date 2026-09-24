// Arte de marca de la web: por cada anime, su escenario (16:9), un fondo
// oscuro y difuminado para la ficha y su símbolo; además, las piezas de
// portada y escenario (galería, sobres, logros, páginas vacías) y el logo.
//
// Todo vive en public/img/marca y lo genera scripts/generate-marca.mjs a
// partir de las ilustraciones originales. Este archivo es la única fuente de
// nombres y anchos: lo usan el generador, scripts/check-data.mjs y la
// interfaz. El campo `marca` de cada anime (src/data/animes.json) es el
// nombre de su arte, que no siempre coincide con su id.
import { urlPublica } from './images.js'

export const CARPETA_MARCA = 'img/marca'

/** Anchos del escenario de cada anime (original 1672 × 941). */
export const ANCHOS_ESCENA = [768, 1280]
export const PROPORCION_ESCENA = 1672 / 941

/** Ancho del fondo difuminado y oscurecido de la ficha (misma proporción). */
export const ANCHO_FONDO = 480

/** Anchos del símbolo de cada anime (cuadrado, con transparencia). */
export const ANCHOS_SIMBOLO = [160, 320]

/**
 * Piezas de portada y escenario: anchos generados y proporción (ancho / alto)
 * del original. Ningún ancho supera el del original.
 */
export const PIEZAS = {
  'personajes-archive': { anchos: [768, 1280, 1672], proporcion: 1672 / 941 },
  'home-hero-vote-arena': { anchos: [768, 1280], proporcion: 1870 / 841 },
  'collection-ssr-share': { anchos: [768, 1024], proporcion: 1 },
  'logros-trophy-hall': { anchos: [768, 1280], proporcion: 1672 / 941 },
  'lost-portal': { anchos: [768, 1280], proporcion: 1672 / 941 },
  'catalog-offline': { anchos: [768, 1280], proporcion: 1672 / 941 },
  'empty-search-night-city-refresh': { anchos: [768, 1280], proporcion: 1672 / 941 },
}

/** Logo de la web (sello 滅), en un solo sitio para poder cambiarlo. */
export const LOGO = {
  webp: `${CARPETA_MARCA}/logo.webp`,
  svg: `${CARPETA_MARCA}/logo.svg`,
}

// Rutas relativas a public/.
export const rutaEscena = (marca, ancho) => `${CARPETA_MARCA}/${marca}-escena-${ancho}.webp`
export const rutaFondo = (marca) => `${CARPETA_MARCA}/${marca}-fondo-${ANCHO_FONDO}.webp`
export const rutaSimbolo = (marca, ancho) => `${CARPETA_MARCA}/${marca}-simbolo-${ancho}.webp`
export const rutaPieza = (nombre, ancho) => `${CARPETA_MARCA}/${nombre}-${ancho}.webp`

/** Todos los archivos de marca de un anime (rutas relativas a public/). */
export function archivosAnime(marca) {
  return [
    ...ANCHOS_ESCENA.map((ancho) => rutaEscena(marca, ancho)),
    rutaFondo(marca),
    ...ANCHOS_SIMBOLO.map((ancho) => rutaSimbolo(marca, ancho)),
  ]
}

/** Todos los archivos de las piezas y el logo (rutas relativas a public/). */
export function archivosComunes() {
  return [
    ...Object.entries(PIEZAS).flatMap(([nombre, { anchos }]) => anchos.map((ancho) => rutaPieza(nombre, ancho))),
    LOGO.webp,
    LOGO.svg,
  ]
}

/** { src, srcSet } a partir de una función de ruta y sus anchos; src es el mayor. */
function conjunto(ruta, anchos, base) {
  return {
    src: urlPublica(ruta(anchos.at(-1)), base),
    srcSet: anchos.map((ancho) => `${urlPublica(ruta(ancho), base)} ${ancho}w`).join(', '),
  }
}

/** Escenario de un anime, o null si no tiene arte de marca. */
export function escenaAnime(anime, base) {
  if (!anime?.marca) return null
  return { ...conjunto((ancho) => rutaEscena(anime.marca, ancho), ANCHOS_ESCENA, base), proporcion: PROPORCION_ESCENA }
}

/** URL del fondo difuminado de un anime, o null si no tiene arte de marca. */
export function fondoAnime(anime, base) {
  return anime?.marca ? urlPublica(rutaFondo(anime.marca), base) : null
}

/** Símbolo de un anime, o null si no tiene arte de marca. */
export function simboloAnime(anime, base) {
  if (!anime?.marca) return null
  return conjunto((ancho) => rutaSimbolo(anime.marca, ancho), ANCHOS_SIMBOLO, base)
}

/** Una pieza de portada o escenario por su nombre (ver PIEZAS). */
export function pieza(nombre, base) {
  const datos = PIEZAS[nombre]
  if (!datos) throw new Error(`Pieza de marca desconocida: ${nombre}`)
  return { ...conjunto((ancho) => rutaPieza(nombre, ancho), datos.anchos, base), proporcion: datos.proporcion }
}
