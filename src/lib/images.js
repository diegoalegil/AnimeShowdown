// URLs de las ilustraciones. Cada carta, personaje o especial, tiene cuatro
// tamaños en public/img: <ruta>-300.webp, -450, -600 y <ruta>.webp (~1024 px
// de ancho), generados por scripts/generate-tamanos.mjs.

const ANCHO_ORIGINAL = 1024

/**
 * Tamaños de presentación más habituales, para el atributo sizes. En el
 * móvil, la rejilla de dos columnas mide la mitad de la pantalla menos los
 * márgenes (unos 165 px) y su nitidez se limita a densidad 2: en pantallas
 * de densidad 3 se declara un tercio del ancho, así que el navegador pide el
 * doble del ancho real (la versión de 450 px), que no se distingue de la de
 * 600 a ese tamaño y pesa un 30 % menos.
 */
export const TAMANOS = {
  muro: '(min-width: 1200px) 210px, (min-width: 1024px) 21vw, (min-width: 768px) 28vw, (min-resolution: 2.5dppx) calc((100vw - 3rem) / 3), calc((100vw - 3rem) / 2)',
  album: '(min-width: 1100px) 170px, (min-width: 768px) 18vw, 30vw',
  ficha: '(min-width: 1024px) 460px, (min-width: 768px) 44vw, 72vw',
  sobre: '(min-width: 768px) 240px, 60vw',
  dia: '150px',
}

/** Une la base pública (BASE_URL de Vite) con una ruta relativa de public/. */
export function urlPublica(ruta, base = import.meta.env.BASE_URL) {
  const b = base.endsWith('/') ? base : `${base}/`
  return b + ruta.replace(/^\/+/, '')
}

/** Proporción (ancho / alto) de la ilustración de una carta: `ar` o 2:3. */
export const proporcionCarta = (carta) => carta.ar ?? 2 / 3

// Hasta dónde se recorta una ilustración que no es 2:3 para llenar el marco
// de la carta. Casi todas son un poco más anchas (0,70-0,78): recortadas
// pierden menos de un 8 % por cada lado y el personaje se ve grande, como
// sus vecinas. Las muy anchas o muy altas perderían demasiado: se ven
// enteras (ver Carta y carta.css).
export const ENTERA_SI_ANCHA = 0.8
export const ENTERA_SI_ALTA = 0.6

/** Si la ilustración se muestra entera en el marco 2:3, en vez de recortada. */
export function cartaEntera(carta) {
  const ar = proporcionCarta(carta)
  return ar >= ENTERA_SI_ANCHA || ar <= ENTERA_SI_ALTA
}

/**
 * Devuelve { src, srcSet, width, height } para una carta. `src` apunta al
 * tamaño medio como respaldo; `srcSet` deja que el navegador elija. width y
 * height dan la proporción real de la ilustración.
 */
export function imagenCarta(carta, base) {
  const ruta = carta.img
  const url = (sufijo) => urlPublica(`${ruta}${sufijo}.webp`, base)
  return {
    src: url('-600'),
    srcSet: `${url('-300')} 300w, ${url('-450')} 450w, ${url('-600')} 600w, ${url('')} ${ANCHO_ORIGINAL}w`,
    width: 600,
    height: Math.round(600 / proporcionCarta(carta)),
  }
}

/**
 * Ref de callback para las ilustraciones: si la imagen ya estaba en caché y
 * está completa al montarse, se marca en el acto, sin fundido (al volver a
 * la galería o al llegar a una ficha no parpadea). Si no, y se monta dentro
 * de un contenedor que ya está cerca de la pantalla (una carta del tramo
 * siguiente, ver anticipar), se pide ya. Es la misma función para todas, sin
 * closures por carta.
 */
export function marcarSiCargada(img) {
  if (!img) return
  if (img.complete && img.naturalWidth > 0) img.dataset.cargada = ''
  else if (img.loading === 'lazy' && img.closest?.(CERCA)) img.loading = 'eager'
}

// ---------------------------------------------------------------------------
// Carga anticipada. Las ilustraciones van con loading="lazy" y cada
// navegador decide cuándo pedirlas: Chrome, algo más de una pantalla antes
// de que se vean; Safari no ve las que están dentro de un contenedor que
// content-visibility se salta (los grupos de la rejilla, las hojas del
// álbum, los estandartes) y las pedía con la carta ya en pantalla, que se
// quedaba vacía mientras llegaban. Un único IntersectionObserver vigila esos
// contenedores: mientras uno está a menos de pantalla y media de la vista
// lleva data-cerca y sus imágenes pasan a loading="eager", así que llegan
// antes que la carta, sin pintar el contenedor antes de tiempo. Lo lejano
// sigue sin pedirse.
// ---------------------------------------------------------------------------

export const MARGEN_ANTICIPO = '150% 0px'
const CERCA = '[data-cerca]'
let anticipador = null

/** Pasa a carga inmediata las imágenes diferidas de `contenedor`. */
export function adelantarImagenes(contenedor) {
  for (const img of contenedor.querySelectorAll('img[loading="lazy"]')) img.loading = 'eager'
}

function obtenerAnticipador() {
  if (anticipador || typeof window === 'undefined' || typeof window.IntersectionObserver !== 'function') return anticipador
  anticipador = new window.IntersectionObserver(
    (entradas) => {
      for (const { target, isIntersecting } of entradas) {
        target.toggleAttribute('data-cerca', isIntersecting)
        if (isIntersecting) adelantarImagenes(target)
      }
    },
    { rootMargin: MARGEN_ANTICIPO },
  )
  return anticipador
}

/**
 * Ref de callback para los contenedores de cartas e ilustraciones
 * (`<div data-diferido ref={anticipar}>`): sus imágenes se piden al
 * acercarse a la pantalla. Es la misma función para todos. Sin
 * IntersectionObserver queda la carga diferida del navegador.
 */
export function anticipar(contenedor) {
  const io = contenedor ? obtenerAnticipador() : null
  if (!io) return undefined
  io.observe(contenedor)
  return () => io.unobserve(contenedor)
}

/**
 * URL de la versión de 600 px: la que la galería suele haber descargado ya
 * (pantallas de densidad 2 o más), útil como fondo mientras carga la grande.
 */
export function imagenIntermedia(carta, base) {
  return urlPublica(`${carta.img}-600.webp`, base)
}

/**
 * Un único par de listeners de captura para todas las ilustraciones: marca
 * data-cargada en la imagen al cargar (para el fundido de entrada) y
 * data-rota en la lámina si falla. Devuelve la función que los quita.
 */
export function vigilarImagenes(raiz = document) {
  const laminaDe = (evento) => {
    const img = evento.target
    return img?.tagName === 'IMG' ? img.closest?.('.carta-lamina') : null
  }
  const alCargar = (evento) => {
    if (laminaDe(evento)) evento.target.dataset.cargada = ''
  }
  const alFallar = (evento) => {
    const lamina = laminaDe(evento)
    if (lamina) lamina.dataset.rota = ''
  }
  raiz.addEventListener('load', alCargar, true)
  raiz.addEventListener('error', alFallar, true)
  return () => {
    raiz.removeEventListener('load', alCargar, true)
    raiz.removeEventListener('error', alFallar, true)
  }
}
