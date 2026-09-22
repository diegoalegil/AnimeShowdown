// URLs de las ilustraciones. Los personajes tienen tres tamaños en public/img
// (<ruta>-300.webp, <ruta>-600.webp y <ruta>.webp, ~1024 px de ancho); las
// especiales tienen un único archivo con extensión en el propio dato.

const ANCHO_ORIGINAL = 1024

/** Tamaños de presentación más habituales, para el atributo sizes. */
export const TAMANOS = {
  muro: '(min-width: 1100px) 290px, (min-width: 768px) 30vw, 46vw',
  album: '(min-width: 1100px) 170px, (min-width: 768px) 18vw, 30vw',
  ficha: '(min-width: 900px) 540px, 100vw',
  sobre: '(min-width: 768px) 240px, 60vw',
}

/** Une la base pública (BASE_URL de Vite) con una ruta relativa de public/. */
export function urlPublica(ruta, base = import.meta.env.BASE_URL) {
  const b = base.endsWith('/') ? base : `${base}/`
  return b + ruta.replace(/^\/+/, '')
}

/**
 * Devuelve { src, srcSet, width, height } para una carta. `src` apunta al
 * tamaño medio como respaldo; `srcSet` deja que el navegador elija.
 */
export function imagenCarta(carta, base) {
  const ruta = carta.img
  if (/\.\w+$/.test(ruta)) {
    // Especial: un único archivo de 1024 × 1536.
    return { src: urlPublica(ruta, base), srcSet: undefined, width: 1024, height: 1536 }
  }
  const url = (sufijo) => urlPublica(`${ruta}${sufijo}.webp`, base)
  return {
    src: url('-600'),
    srcSet: `${url('-300')} 300w, ${url('-600')} 600w, ${url('')} ${ANCHO_ORIGINAL}w`,
    width: 600,
    height: 900,
  }
}
