// Títulos y descripciones de página. Los usan la aplicación y el prerender
// (scripts/prerender.mjs), así que no dependen de React ni del navegador.

const MARCA = 'AnimeShowdown'

/** «Galería · AnimeShowdown», o solo la marca en la portada. */
export function tituloDePagina(texto) {
  return texto ? `${texto} · ${MARCA}` : MARCA
}

/** Nombre con el que se titula una carta: las variantes van entre paréntesis. */
export function nombreCarta(carta) {
  return carta.variante ? `${carta.nombre} (${carta.variante})` : carta.nombre
}

/** Descripción de la ficha: la escrita a mano si existe, si no una genérica. */
export function descripcionCarta(carta) {
  const especial = carta.id.startsWith('e-')
  // «de Akame ga Kill!» ya cierra la frase: no se añade otro punto.
  const punto = /[.!?…]$/.test(carta.anime) ? '' : '.'
  const base = `${especial ? 'Carta especial' : 'Carta'} de ${nombreCarta(carta)}, de ${carta.anime}${punto}`
  return carta.desc ? `${base} ${carta.desc}` : `${base} Ábrela en los sobres diarios de AnimeShowdown y añádela a tu colección.`
}

export const PAGINAS = {
  galeria: {
    titulo: undefined,
    descripcion:
      'Galería de cartas de personajes de anime. Explora más de mil cartas, abre cinco sobres al día y completa tu colección.',
  },
  sobres: {
    titulo: 'Sobres',
    descripcion: 'Abre cinco sobres al día, con cinco cartas cada uno. La última puede ser una carta especial.',
  },
  coleccion: {
    titulo: 'Colección',
    descripcion: 'Tu álbum de cartas de AnimeShowdown, guardado en este navegador y sin necesidad de cuenta.',
  },
}
