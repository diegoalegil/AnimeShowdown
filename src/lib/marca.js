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
 * de la imagen final. Ningún ancho supera el del original (o el del recorte).
 *
 * Una pieza puede salir de otra ilustración (`origen`, sin extensión) y de
 * un trozo de ella (`recorte`: x, y, ancho y alto en píxeles del original).
 * La arena de los sobres es el centro de la del antiguo inicio: a los lados
 * tenía los marcadores de ELO de la web de votaciones.
 */
export const PIEZAS = {
  'personajes-archive': { anchos: [768, 1280, 1672], proporcion: 1672 / 941 },
  'sobres-arena': { origen: 'home-hero-vote-arena', recorte: [400, 0, 1070, 841], anchos: [768, 1070], proporcion: 1070 / 841 },
  'collection-ssr-share': { anchos: [768, 1024], proporcion: 1 },
  'logros-trophy-hall': { anchos: [768, 1280], proporcion: 1672 / 941 },
  'lost-portal': { anchos: [768, 1280], proporcion: 1672 / 941 },
  'catalog-offline': { anchos: [768, 1280], proporcion: 1672 / 941 },
  'empty-search-night-city-refresh': { anchos: [768, 1280], proporcion: 1672 / 941 },
}

/**
 * Escenario de cada sección, a todo el ancho (sizes 100vw): su HTML lo
 * precarga (ver scripts/prerender.mjs), con el mismo srcset que su <img>.
 */
export const ESCENARIOS = { sobres: 'sobres-arena', coleccion: 'logros-trophy-hall' }

/**
 * sizes de la sala de la portada: a partir de 1280 px basta la de 1280. En
 * el móvil la sala es un fondo recortado y oscurecido tras el título y la de
 * 768 px no se distingue de las grandes: se declaran 256 px para que el
 * navegador la elija en cualquier densidad (hasta 3×). Pesa la mitad, y es
 * lo que más tarda en llegar de la primera pantalla.
 */
export const TAMANO_SALA = '(min-width: 1280px) 1280px, (min-width: 48rem) 100vw, 256px'

/**
 * Logo de la web (sello 滅), en un solo sitio para poder cambiarlo: el
 * original (webp y svg), sus versiones pequeñas para la cabecera y el pie, y
 * los PNG del icono de la pestaña y de la pantalla de inicio. Las versiones
 * derivadas las genera scripts/generate-marca.mjs a partir de logo.webp.
 */
export const LOGO = {
  webp: `${CARPETA_MARCA}/logo.webp`,
  svg: `${CARPETA_MARCA}/logo.svg`,
  favicon: `${CARPETA_MARCA}/logo-64.png`,
  tactil: `${CARPETA_MARCA}/logo-180.png`,
}

/** Anchos de las versiones pequeñas del logo (cuadrado). */
export const ANCHOS_LOGO = [64, 128]

// Rutas relativas a public/.
export const rutaEscena = (marca, ancho) => `${CARPETA_MARCA}/${marca}-escena-${ancho}.webp`
export const rutaFondo = (marca) => `${CARPETA_MARCA}/${marca}-fondo-${ANCHO_FONDO}.webp`
export const rutaSimbolo = (marca, ancho) => `${CARPETA_MARCA}/${marca}-simbolo-${ancho}.webp`
export const rutaPieza = (nombre, ancho) => `${CARPETA_MARCA}/${nombre}-${ancho}.webp`
export const rutaLogo = (ancho) => `${CARPETA_MARCA}/logo-${ancho}.webp`

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
    LOGO.favicon,
    LOGO.tactil,
    ...ANCHOS_LOGO.map(rutaLogo),
  ]
}

/** { src, srcSet } a partir de una función de ruta y sus anchos; src es el mayor. */
function conjunto(ruta, anchos, base) {
  return {
    src: urlPublica(ruta(anchos.at(-1)), base),
    srcSet: anchos.map((ancho) => `${urlPublica(ruta(ancho), base)} ${ancho}w`).join(', '),
  }
}

/**
 * Escenario de un anime, o null si no tiene arte de marca. `foco` es su
 * object-position («50% 80%») si el anime lo anota: dónde está lo importante
 * de la escena, para que las franjas estrechas la recorten por ahí.
 */
export function escenaAnime(anime, base) {
  if (!anime?.marca) return null
  return {
    ...conjunto((ancho) => rutaEscena(anime.marca, ancho), ANCHOS_ESCENA, base),
    proporcion: PROPORCION_ESCENA,
    foco: anime.foco,
  }
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

/** Versiones pequeñas del logo ({ src, srcSet }), para un <img> con sizes. */
export const logo = (base) => conjunto(rutaLogo, ANCHOS_LOGO, base)
